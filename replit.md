# MLS Grid IDX/CMA Platform

## Overview

This project is a professional real estate IDX (Internet Data Exchange) platform integrated with the MLS Grid API. Its primary purpose is to empower real estate agents with tools for property searching, generating Comparative Market Analyses (CMAs), and sharing market insights with clients. The platform aims to combine comprehensive property browsing (similar to Zillow or Redfin) with robust, productivity-focused workflow features to streamline real estate operations.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

The frontend is built with React and TypeScript, using Vite for development and bundling. It utilizes `shadcn/ui` (New York style variant) based on Radix UI for its component system, prioritizing visual appeal for client engagement and functional efficiency for agents. Styling is managed with Tailwind CSS, incorporating custom design tokens for consistency and supporting light/dark modes. State management is handled by TanStack Query with aggressive caching, and Wouter provides lightweight client-side routing. Key pages include Dashboard, Property Search, Property Detail, CMA management, and CMA report generation.

### Backend Architecture

The backend is developed with Node.js and Express in TypeScript, using an ESM module system. It exposes a RESTful API with type-safe request/response handling for properties, CMAs, and system health checks. A flexible storage interface (`IStorage`) supports in-memory, database (PostgreSQL via Drizzle ORM), and hybrid storage solutions. The system includes a built-in rate limiter to comply with MLS Grid API usage policies, automatically queuing and delaying requests to maintain limits (2 req/sec, 7200 req/hour).

### Database Schema

The platform uses Drizzle ORM with PostgreSQL, adhering to type-safe schema definitions. Core tables include `properties` (RESO Data Dictionary compliant data), `media` (for property images), `saved_searches`, and `cmas`. Zod schemas are used for runtime validation, generated from Drizzle schemas. The design philosophy strictly follows the MLS Grid's RESO Data Dictionary standard while accommodating MLS-specific fields.

## External Dependencies

- **MLS Grid API**: The primary data source for property listings, providing data from various MLS systems. It handles authentication, automated data synchronization, and RESO Data Dictionary standardization.
- **PostgreSQL**: Used for persistent data storage in production environments, leveraging the Neon serverless driver.
- **Amazon S3**: Utilized for storing media assets, such as property images and documents.
- **`connect-pg-simple`**: Provides PostgreSQL-backed session management.
- **Google Fonts CDN**: Used for typography, specifically the Inter font family.
- **Recharts**: Integrated for charting and data visualization within CMA reports.
- **SendGrid**: Used for email services, such as sending seller updates.