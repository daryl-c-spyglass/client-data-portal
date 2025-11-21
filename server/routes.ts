import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { createMLSGridClient } from "./mlsgrid-client";
import { searchCriteriaSchema, insertCmaSchema, insertUserSchema, insertSellerUpdateSchema, updateSellerUpdateSchema } from "@shared/schema";
import { findMatchingProperties, calculateMarketSummary } from "./seller-update-service";
import { z } from "zod";
import bcrypt from "bcryptjs";
import passport from "passport";
import { requireAuth, requireRole } from "./auth";

export async function registerRoutes(app: Express): Promise<Server> {
  const mlsGridClient = createMLSGridClient();

  // Auth routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      // Rename passwordHash field to password for client-facing API
      const { passwordHash, ...rest } = insertUserSchema.parse(req.body);
      
      const existingUser = await storage.getUserByEmail(rest.email);
      if (existingUser) {
        res.status(400).json({ error: "Email already in use" });
        return;
      }

      const hashedPassword = await bcrypt.hash(passwordHash, 10);
      const user = await storage.createUser({ ...rest, passwordHash: hashedPassword });
      
      // SECURITY: Never return password hash to client
      const { passwordHash: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to register user" });
      }
    }
  });

  app.post("/api/auth/login", passport.authenticate("local"), (req, res) => {
    // req.user is already sanitized by passport.deserializeUser
    res.json(req.user);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout(() => {
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/me", requireAuth, (req, res) => {
    // req.user is already sanitized by passport.deserializeUser
    res.json(req.user);
  });

  // Property routes
  app.get("/api/properties/search", async (req, res) => {
    try {
      // Pre-transform array.values/array.mode query params to arrays
      const transformedQuery: any = { ...req.query };
      
      // Handle subdivision.values → subdivisions (array format from frontend)
      if (transformedQuery['subdivision.values']) {
        transformedQuery.subdivisions = Array.isArray(transformedQuery['subdivision.values']) 
          ? transformedQuery['subdivision.values'] 
          : [transformedQuery['subdivision.values']];
        delete transformedQuery['subdivision.values'];
        delete transformedQuery['subdivision.mode']; // Mode not used yet but remove anyway
      }
      
      // Handle subdivision → subdivisions (singular format, just in case)
      if (transformedQuery['subdivision'] && !transformedQuery.subdivisions) {
        const subdivisionValue = transformedQuery['subdivision'];
        transformedQuery.subdivisions = typeof subdivisionValue === 'string'
          ? subdivisionValue.split(',').map(s => s.trim()).filter(Boolean)
          : Array.isArray(subdivisionValue) 
            ? subdivisionValue 
            : [subdivisionValue];
        delete transformedQuery['subdivision'];
        delete transformedQuery['subdivisionMode'];
      }
      
      // Parse and coerce query params to proper types
      const rawCriteria = searchCriteriaSchema.parse(transformedQuery);
      
      // Transform dot-notation fields into nested objects
      const criteria: any = { ...rawCriteria };
      
      // Handle yearBuilt range
      if (criteria['yearBuilt.min'] || criteria['yearBuilt.max']) {
        criteria.yearBuilt = {
          min: criteria['yearBuilt.min'],
          max: criteria['yearBuilt.max'],
        };
        delete criteria['yearBuilt.min'];
        delete criteria['yearBuilt.max'];
      }
      
      // Handle livingArea range
      if (criteria['livingArea.min'] || criteria['livingArea.max']) {
        criteria.livingArea = {
          min: criteria['livingArea.min'],
          max: criteria['livingArea.max'],
        };
        delete criteria['livingArea.min'];
        delete criteria['livingArea.max'];
      }
      
      // Handle lotSizeSquareFeet range
      if (criteria['lotSizeSquareFeet.min'] || criteria['lotSizeSquareFeet.max']) {
        criteria.lotSizeSquareFeet = {
          min: criteria['lotSizeSquareFeet.min'],
          max: criteria['lotSizeSquareFeet.max'],
        };
        delete criteria['lotSizeSquareFeet.min'];
        delete criteria['lotSizeSquareFeet.max'];
      }
      
      // Handle lotSizeAcres range
      if (criteria['lotSizeAcres.min'] || criteria['lotSizeAcres.max']) {
        criteria.lotSizeAcres = {
          min: criteria['lotSizeAcres.min'],
          max: criteria['lotSizeAcres.max'],
        };
        delete criteria['lotSizeAcres.min'];
        delete criteria['lotSizeAcres.max'];
      }
      
      // Limit to 50 properties by default to prevent OOM errors
      // Supports optional limit and offset query parameters for pagination
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      
      // Pass limit and offset to storage layer for database-level pagination
      const paginatedProperties = await storage.getProperties(criteria, limit, offset);
      
      res.json(paginatedProperties);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Search validation error:", error.errors);
        res.status(400).json({ error: "Invalid search criteria", details: error.errors });
      } else {
        console.error("Search error:", error);
        res.status(500).json({ error: "Failed to search properties" });
      }
    }
  });

  app.get("/api/properties/count", async (req, res) => {
    try {
      const count = await storage.getPropertyCount();
      res.json({ count });
    } catch (error) {
      console.error("Failed to fetch property count:", error);
      res.status(500).json({ error: "Failed to fetch property count" });
    }
  });

  app.get("/api/properties/:id", async (req, res) => {
    try {
      const property = await storage.getProperty(req.params.id);
      if (!property) {
        res.status(404).json({ error: "Property not found" });
        return;
      }
      res.json(property);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch property" });
    }
  });

  app.get("/api/properties", async (req, res) => {
    try {
      // Limit to 1000 properties by default to prevent OOM
      // Frontend uses search endpoint for filtered/criteria-based queries
      const limit = parseInt(req.query.limit as string) || 1000;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const allProperties = await storage.getAllProperties();
      const paginatedProperties = allProperties.slice(offset, offset + limit);
      
      res.json(paginatedProperties);
    } catch (error) {
      console.error("Failed to fetch properties:", error);
      res.status(500).json({ error: "Failed to fetch properties" });
    }
  });

  // Media routes
  app.get("/api/media/:id", async (req, res) => {
    try {
      const media = await storage.getMedia(req.params.id);
      if (!media) {
        res.status(404).json({ error: "Media not found" });
        return;
      }
      res.json(media);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch media" });
    }
  });

  app.get("/api/media/property/:listingId", async (req, res) => {
    try {
      const media = await storage.getMediaByResourceKey(req.params.listingId);
      res.json(media);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch media" });
    }
  });

  // Saved search routes
  app.get("/api/searches", async (req, res) => {
    try {
      const searches = await storage.getAllSavedSearches();
      res.json(searches);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch saved searches" });
    }
  });

  app.get("/api/searches/:id", async (req, res) => {
    try {
      const search = await storage.getSavedSearch(req.params.id);
      if (!search) {
        res.status(404).json({ error: "Saved search not found" });
        return;
      }
      res.json(search);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch saved search" });
    }
  });

  app.post("/api/searches", async (req, res) => {
    try {
      const search = await storage.createSavedSearch(req.body);
      res.status(201).json(search);
    } catch (error) {
      res.status(500).json({ error: "Failed to create saved search" });
    }
  });

  app.delete("/api/searches/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteSavedSearch(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: "Saved search not found" });
        return;
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete saved search" });
    }
  });

  // CMA routes
  app.get("/api/cmas", async (req, res) => {
    try {
      const cmas = await storage.getAllCmas();
      res.json(cmas);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch CMAs" });
    }
  });

  app.get("/api/cmas/:id", async (req, res) => {
    try {
      const cma = await storage.getCma(req.params.id);
      if (!cma) {
        res.status(404).json({ error: "CMA not found" });
        return;
      }
      res.json(cma);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch CMA" });
    }
  });

  app.post("/api/cmas", async (req, res) => {
    try {
      const cmaData = insertCmaSchema.parse(req.body);
      const cma = await storage.createCma(cmaData);
      res.status(201).json(cma);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid CMA data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create CMA" });
      }
    }
  });

  app.put("/api/cmas/:id", async (req, res) => {
    try {
      const cma = await storage.updateCma(req.params.id, req.body);
      if (!cma) {
        res.status(404).json({ error: "CMA not found" });
        return;
      }
      res.json(cma);
    } catch (error) {
      res.status(500).json({ error: "Failed to update CMA" });
    }
  });

  app.delete("/api/cmas/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteCma(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: "CMA not found" });
        return;
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete CMA" });
    }
  });

  // Seller Update routes - Quick Seller Update feature
  app.get("/api/seller-updates", async (req, res) => {
    try {
      const updates = await storage.getAllSellerUpdates();
      res.json(updates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch seller updates" });
    }
  });

  app.get("/api/seller-updates/:id", async (req, res) => {
    try {
      const update = await storage.getSellerUpdate(req.params.id);
      if (!update) {
        res.status(404).json({ error: "Seller update not found" });
        return;
      }
      res.json(update);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch seller update" });
    }
  });

  app.post("/api/seller-updates", async (req, res) => {
    try {
      const updateData = insertSellerUpdateSchema.parse(req.body);
      
      // For embeddable widgets: create or find user by email if userId is "guest"
      let userId = updateData.userId;
      if (userId === "guest") {
        const email = updateData.email;
        let user = await storage.getUserByEmail(email);
        
        if (!user) {
          // Create a new user with minimal info from the form
          user = await storage.createUser({
            email,
            passwordHash: "", // Empty for guest users created from embed forms
            role: "client",
            firstName: updateData.name.split(' ')[0],
            lastName: updateData.name.split(' ').slice(1).join(' ') || "",
          });
        }
        
        userId = user.id;
      }
      
      const update = await storage.createSellerUpdate({
        ...updateData,
        userId,
      });
      res.status(201).json(update);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid seller update data", details: error.errors });
      } else {
        console.error("Error creating seller update:", error);
        res.status(500).json({ error: "Failed to create seller update" });
      }
    }
  });

  app.patch("/api/seller-updates/:id", async (req, res) => {
    try {
      const updateData = updateSellerUpdateSchema.parse(req.body);
      const update = await storage.updateSellerUpdate(req.params.id, updateData);
      if (!update) {
        res.status(404).json({ error: "Seller update not found" });
        return;
      }
      res.json(update);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid update data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to update seller update" });
      }
    }
  });

  app.delete("/api/seller-updates/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteSellerUpdate(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: "Seller update not found" });
        return;
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete seller update" });
    }
  });

  // Elementary schools autocomplete endpoint
  app.get("/api/schools/elementary", async (req, res) => {
    try {
      const search = (req.query.search as string) || '';
      const allProperties = await storage.getAllProperties();
      
      // Get unique elementary schools, filter by search, and sort
      const schools = Array.from(new Set(
        allProperties
          .map(p => p.elementarySchool)
          .filter((school): school is string => 
            school !== null && 
            school !== undefined && 
            school.trim() !== '' &&
            school.toLowerCase().includes(search.toLowerCase())
          )
      )).sort();
      
      res.json(schools.slice(0, 50)); // Limit to 50 results for autocomplete
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch elementary schools" });
    }
  });

  app.get("/api/properties/types", async (req, res) => {
    try {
      const allProperties = await storage.getAllProperties();
      
      // Get unique property subtypes and sort
      const types = Array.from(new Set(
        allProperties
          .map(p => p.propertySubType)
          .filter((type): type is string => 
            type !== null && 
            type !== undefined && 
            type.trim() !== ''
          )
      )).sort();
      
      res.json(types);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch property types" });
    }
  });

  // Preview matching properties for a seller update
  app.get("/api/seller-updates/:id/preview", async (req, res) => {
    try {
      const sellerUpdate = await storage.getSellerUpdate(req.params.id);
      if (!sellerUpdate) {
        res.status(404).json({ error: "Seller update not found" });
        return;
      }
      
      const result = await findMatchingProperties(sellerUpdate);
      const marketSummary = calculateMarketSummary(result.properties);
      
      res.json({
        ...result,
        marketSummary,
        properties: result.properties.slice(0, 20), // Limit to 20 for preview
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to preview matching properties" });
    }
  });

  // CMA Statistics
  app.get("/api/cmas/:id/statistics", async (req, res) => {
    try {
      const cma = await storage.getCma(req.params.id);
      if (!cma) {
        res.status(404).json({ error: "CMA not found" });
        return;
      }

      const propertyIds = [
        ...(cma.subjectPropertyId ? [cma.subjectPropertyId] : []),
        ...(cma.comparablePropertyIds || [])
      ];

      const statistics = await storage.calculateStatistics(propertyIds);
      res.json(statistics);
    } catch (error) {
      res.status(500).json({ error: "Failed to calculate statistics" });
    }
  });

  app.get("/api/cmas/:id/timeline", async (req, res) => {
    try {
      const cma = await storage.getCma(req.params.id);
      if (!cma) {
        res.status(404).json({ error: "CMA not found" });
        return;
      }

      const propertyIds = [
        ...(cma.subjectPropertyId ? [cma.subjectPropertyId] : []),
        ...(cma.comparablePropertyIds || [])
      ];

      const timelineData = await storage.getTimelineData(propertyIds);
      res.json(timelineData);
    } catch (error) {
      res.status(500).json({ error: "Failed to get timeline data" });
    }
  });

  // MLS Grid sync endpoint
  app.post("/api/sync", async (req, res) => {
    try {
      if (!mlsGridClient) {
        res.status(503).json({ error: "MLS Grid API not configured" });
        return;
      }

      const { lastSyncTime } = req.body;
      const timestamp = lastSyncTime ? new Date(lastSyncTime) : undefined;
      
      // This would trigger a background sync process
      // For now, we'll just return success
      res.json({ message: "Sync initiated", timestamp: new Date().toISOString() });
    } catch (error) {
      res.status(500).json({ error: "Failed to initiate sync" });
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      mlsGridConfigured: mlsGridClient !== null,
      timestamp: new Date().toISOString() 
    });
  });

  const httpServer = createServer(app);

  return httpServer;
}
