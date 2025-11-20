import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { createMLSGridClient } from "./mlsgrid-client";
import { searchCriteriaSchema, insertCmaSchema, insertUserSchema } from "@shared/schema";
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
      // Parse and coerce query params to proper types
      const rawCriteria = searchCriteriaSchema.parse(req.query);
      
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
      
      const properties = await storage.getProperties(criteria);
      res.json(properties);
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
      const properties = await storage.getAllProperties();
      res.json(properties);
    } catch (error) {
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
