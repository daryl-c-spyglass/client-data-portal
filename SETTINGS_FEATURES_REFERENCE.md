# Settings Page Features Reference

This document contains the complete implementation code for the Settings page Bio & Cover Letter and Social & Web Links features.

---

## 1. Database Schema (Drizzle ORM with PostgreSQL)

### Agent Profiles Table

```typescript
// shared/schema.ts

import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const agentProfiles = pgTable("agent_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().unique(), // Foreign key to users table
  title: text("title"), // e.g., "Broker/Owner", "Realtor"
  headshotUrl: text("headshot_url"),
  bio: text("bio"),
  defaultCoverLetter: text("default_cover_letter"),
  // Social links
  facebookUrl: text("facebook_url"),
  instagramUrl: text("instagram_url"),
  linkedinUrl: text("linkedin_url"),
  twitterUrl: text("twitter_url"),
  websiteUrl: text("website_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Zod validation schema for updates
export const updateAgentProfileSchema = z.object({
  title: z.string().optional(),
  headshotUrl: z.string().url({ message: 'Must be a valid URL or object storage path' }).optional().or(z.literal('')),
  bio: z.string().optional(),
  defaultCoverLetter: z.string().optional(),
  facebookUrl: z.string().url().optional().or(z.literal('')),
  instagramUrl: z.string().url().optional().or(z.literal('')),
  linkedinUrl: z.string().url().optional().or(z.literal('')),
  twitterUrl: z.string().url().optional().or(z.literal('')),
  websiteUrl: z.string().url().optional().or(z.literal('')),
});

// Types
export type AgentProfile = typeof agentProfiles.$inferSelect;
export type InsertAgentProfile = typeof agentProfiles.$inferInsert;
export type UpdateAgentProfile = z.infer<typeof updateAgentProfileSchema>;
```

### Users Table (relevant fields)

```typescript
// Users table should include these fields for the profile
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  phone: text("phone"),
  company: text("company"),
  picture: text("picture"), // Google profile picture
  // ... other fields
});
```

---

## 2. Storage Interface

```typescript
// server/storage.ts

export interface IStorage {
  // Agent Profile operations
  getAgentProfile(userId: string): Promise<AgentProfile | undefined>;
  createAgentProfile(profile: InsertAgentProfile): Promise<AgentProfile>;
  updateAgentProfile(userId: string, profile: UpdateAgentProfile): Promise<AgentProfile | undefined>;
  
  // User operations
  getUser(userId: string): Promise<User | undefined>;
  updateUser(userId: string, data: Partial<User>): Promise<User | undefined>;
}

// PostgreSQL Implementation
export class DatabaseStorage implements IStorage {
  private db: DrizzleInstance;
  
  async getAgentProfile(userId: string): Promise<AgentProfile | undefined> {
    const result = await this.db
      .select()
      .from(agentProfiles)
      .where(eq(agentProfiles.userId, userId))
      .limit(1);
    return result[0];
  }

  async createAgentProfile(profile: InsertAgentProfile): Promise<AgentProfile> {
    const result = await this.db
      .insert(agentProfiles)
      .values(profile)
      .returning();
    return result[0];
  }

  async updateAgentProfile(userId: string, profile: UpdateAgentProfile): Promise<AgentProfile | undefined> {
    const existing = await this.getAgentProfile(userId);
    if (!existing) {
      // Create new profile if doesn't exist (upsert behavior)
      const result = await this.db
        .insert(agentProfiles)
        .values({ userId, ...profile })
        .returning();
      return result[0];
    }
    const result = await this.db
      .update(agentProfiles)
      .set({ ...profile, updatedAt: new Date() })
      .where(eq(agentProfiles.userId, userId))
      .returning();
    return result[0];
  }
}
```

---

## 3. API Endpoints

### GET /api/agent/profile - Fetch Profile

```typescript
// server/routes.ts

app.get("/api/agent/profile", requireAuth, async (req, res) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const profile = await storage.getAgentProfile(userId);
    const user = await storage.getUser(userId);
    
    res.json({
      profile: profile || null,
      user: user ? {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        company: user.company,
        picture: user.picture,
      } : null,
    });
  } catch (error: any) {
    console.error("[Agent Profile] Error fetching profile:", error.message);
    res.status(500).json({ error: "Failed to fetch agent profile" });
  }
});
```

### PUT /api/agent/profile - Update Profile

```typescript
// server/routes.ts

app.put("/api/agent/profile", requireAuth, async (req, res) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const { updateAgentProfileSchema } = await import("@shared/schema");
    const profileData = updateAgentProfileSchema.partial().safeParse(req.body.profile || {});
    
    if (!profileData.success) {
      return res.status(400).json({ error: "Invalid profile data", details: profileData.error.issues });
    }
    
    // Update agent profile
    const updatedProfile = await storage.updateAgentProfile(userId, profileData.data);
    
    // Update user basic info if provided
    if (req.body.user) {
      const userData = {
        firstName: req.body.user.firstName,
        lastName: req.body.user.lastName,
        phone: req.body.user.phone,
        company: req.body.user.company,
      };
      await storage.updateUser(userId, userData);
    }
    
    res.json({ success: true, profile: updatedProfile });
  } catch (error: any) {
    console.error("[Agent Profile] Error updating profile:", error.message);
    res.status(500).json({ error: "Failed to update agent profile" });
  }
});
```

### POST /api/ai/generate-default-cover-letter - AI Cover Letter Generation

```typescript
// server/routes.ts

app.post("/api/ai/generate-default-cover-letter", requireAuth, async (req, res) => {
  try {
    const { generateDefaultCoverLetter, isOpenAIConfigured } = await import("./openai-client");
    
    if (!isOpenAIConfigured()) {
      res.status(503).json({ 
        error: "AI assistant is not configured. Please add your OpenAI API key.",
        configured: false
      });
      return;
    }

    const userId = (req as any).userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { tone = 'professional', existingCoverLetter } = req.body;
    
    // Validate tone
    const validTones = ['professional', 'friendly', 'confident'];
    if (!validTones.includes(tone)) {
      res.status(400).json({ error: "Tone must be professional, friendly, or confident" });
      return;
    }

    // Get agent profile data
    const user = await storage.getUser(userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const agentProfile = await storage.getAgentProfile(userId);
    
    const agentName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Agent';
    const context = {
      agentName,
      title: agentProfile?.title || undefined,
      company: user.company || 'Your Company',
      bio: agentProfile?.bio || undefined,
      existingCoverLetter: existingCoverLetter || undefined,
    };

    console.log('[AI] Generating default cover letter:', {
      userId,
      tone,
      hasName: !!agentName,
      hasBio: !!context.bio,
      hasExisting: !!existingCoverLetter,
      mode: existingCoverLetter ? 'enhance' : 'generate',
    });

    const coverLetter = await generateDefaultCoverLetter(
      context, 
      tone as 'professional' | 'friendly' | 'confident'
    );
    res.json({ coverLetter });
  } catch (error: any) {
    console.error("[AI Default Cover Letter] Error:", error.message);
    res.status(500).json({ error: "Failed to generate cover letter. Please try again." });
  }
});
```

---

## 4. OpenAI Client - Cover Letter Generation

```typescript
// server/openai-client.ts

import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

export type CoverLetterTone = 'professional' | 'friendly' | 'confident';

export interface DefaultCoverLetterContext {
  agentName: string;
  title?: string;
  company?: string;
  bio?: string;
  existingCoverLetter?: string;
}

function buildDefaultCoverLetterPrompt(
  context: DefaultCoverLetterContext, 
  tone: CoverLetterTone
): string {
  // If there's existing content, enhance it rather than generating from scratch
  if (context.existingCoverLetter && context.existingCoverLetter.trim().length > 20) {
    return `You are a professional editor helping a real estate agent improve their existing cover letter for Comparative Market Analysis (CMA) reports.

Agent Information:
- Name: ${context.agentName}
- Title: ${context.title || 'Real Estate Agent'}
- Company: ${context.company || 'our brokerage'}
${context.bio ? `- About: ${context.bio}` : ''}

Their EXISTING cover letter:
"""
${context.existingCoverLetter}
"""

Your task:
1. ENHANCE and IMPROVE this existing cover letter while preserving the agent's voice and key messages
2. Apply a ${tone} tone throughout
3. Improve clarity, flow, and professional polish
4. Keep any placeholders like [Client Name] intact
5. Keep it concise (2-3 paragraphs, ~150-200 words)
6. Do NOT add specific property details or market statistics

Tone guidelines:
- Professional: Formal, business-like, authoritative
- Friendly: Warm, personable, approachable  
- Confident: Bold, assertive, results-focused

Return ONLY the improved cover letter text. No commentary or explanations.`;
  }
  
  // Generate new cover letter from scratch
  return `You are writing a default cover letter TEMPLATE for a real estate agent to use in their Comparative Market Analysis (CMA) reports.

Agent Information:
- Name: ${context.agentName}
- Title: ${context.title || 'Real Estate Agent'}
- Company: ${context.company || 'our brokerage'}
${context.bio ? `- About: ${context.bio}` : ''}

Requirements:
1. Write a ${tone} cover letter template
2. Use [Client Name] as a placeholder for personalization
3. The letter should:
   - Thank the client for the opportunity
   - Briefly introduce the agent and their expertise
   - Explain the purpose of the CMA report
   - Offer to discuss the findings
4. Keep it concise (2-3 paragraphs, ~150-200 words)
5. Do NOT include specific property details or market statistics (those vary per CMA)
6. Make it a reusable template that works for any property

Tone guidelines:
- Professional: Formal, business-like, authoritative
- Friendly: Warm, personable, approachable
- Confident: Bold, assertive, results-focused

Write only the cover letter content. No additional commentary.`;
}

export async function generateDefaultCoverLetter(
  context: DefaultCoverLetterContext,
  tone: CoverLetterTone = 'professional'
): Promise<string> {
  const prompt = buildDefaultCoverLetterPrompt(context, tone);

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "user", content: prompt }
      ],
      max_tokens: 1024,
      temperature: 0.7,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("Empty response from AI");
    }

    return content.trim();
  } catch (error: any) {
    console.error("Cover letter generation error:", error);
    throw new Error(`Failed to generate cover letter: ${error.message}`);
  }
}
```

---

## 5. React Component - Complete Settings Profile Tab

### TypeScript Interfaces

```typescript
// Types for the Settings component

interface AgentProfile {
  id?: string;
  userId?: string;
  title?: string;
  headshotUrl?: string;
  bio?: string;
  defaultCoverLetter?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
  websiteUrl?: string;
}

interface UserData {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  picture?: string;
}

interface AgentProfileResponse {
  profile: AgentProfile | null;
  user: UserData | null;
}
```

### State Management

```typescript
// Inside Settings component

const { toast } = useToast();
const queryClient = useQueryClient();

// Agent profile state
const [profileForm, setProfileForm] = useState({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  company: '',
  title: '',
  headshotUrl: '',
  bio: '',
  defaultCoverLetter: '',
  websiteUrl: '',
  facebookUrl: '',
  instagramUrl: '',
  linkedinUrl: '',
  twitterUrl: '',
});
const [originalProfile, setOriginalProfile] = useState(profileForm);
const [hasProfileChanges, setHasProfileChanges] = useState(false);
const [aiCoverLetterTone, setAiCoverLetterTone] = useState<'professional' | 'friendly' | 'confident'>('professional');
const [isGeneratingCoverLetter, setIsGeneratingCoverLetter] = useState(false);
```

### AI Cover Letter Generation Handler

```typescript
const handleGenerateCoverLetter = async () => {
  const hasName = !!(profileForm.firstName || profileForm.lastName);
  if (!hasName) {
    toast({
      title: "Profile Required",
      description: "Please fill in your name above before generating.",
      variant: "destructive",
    });
    return;
  }

  setIsGeneratingCoverLetter(true);

  try {
    const response = await fetch('/api/ai/generate-default-cover-letter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        tone: aiCoverLetterTone,
        existingCoverLetter: profileForm.defaultCoverLetter || undefined,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate');
    }

    const data = await response.json();

    if (data.coverLetter) {
      setProfileForm(prev => ({ ...prev, defaultCoverLetter: data.coverLetter }));
      toast({
        title: "Cover Letter Generated",
        description: "You can edit the generated text below.",
      });
    }
  } catch (error) {
    console.error('[Settings] AI generation failed:', error);
    toast({
      title: "Generation Failed",
      description: "Could not generate cover letter. Please try again.",
      variant: "destructive",
    });
  } finally {
    setIsGeneratingCoverLetter(false);
  }
};
```

### Data Fetching with TanStack Query

```typescript
// Fetch agent profile
const { data: agentProfileData, isLoading: isLoadingProfile } = useQuery<AgentProfileResponse>({
  queryKey: ["/api/agent/profile"],
  enabled: activeTab === "profile",
});

// Populate profile form when data is fetched
useEffect(() => {
  if (agentProfileData) {
    const form = {
      firstName: agentProfileData.user?.firstName || '',
      lastName: agentProfileData.user?.lastName || '',
      email: agentProfileData.user?.email || '',
      phone: agentProfileData.user?.phone || '',
      company: agentProfileData.user?.company || '',
      title: agentProfileData.profile?.title || '',
      headshotUrl: agentProfileData.profile?.headshotUrl || agentProfileData.user?.picture || '',
      bio: agentProfileData.profile?.bio || '',
      defaultCoverLetter: agentProfileData.profile?.defaultCoverLetter || '',
      websiteUrl: agentProfileData.profile?.websiteUrl || '',
      facebookUrl: agentProfileData.profile?.facebookUrl || '',
      instagramUrl: agentProfileData.profile?.instagramUrl || '',
      linkedinUrl: agentProfileData.profile?.linkedinUrl || '',
      twitterUrl: agentProfileData.profile?.twitterUrl || '',
    };
    setProfileForm(form);
    setOriginalProfile(form);
    setHasProfileChanges(false);
  }
}, [agentProfileData]);

// Track profile changes
useEffect(() => {
  const changed = JSON.stringify(profileForm) !== JSON.stringify(originalProfile);
  setHasProfileChanges(changed);
}, [profileForm, originalProfile]);
```

### Save Profile Mutation

```typescript
const saveProfileMutation = useMutation({
  mutationFn: async () => {
    const response = await apiRequest("/api/agent/profile", "PUT", {
      profile: {
        title: profileForm.title,
        headshotUrl: profileForm.headshotUrl,
        bio: profileForm.bio,
        defaultCoverLetter: profileForm.defaultCoverLetter,
        websiteUrl: profileForm.websiteUrl,
        facebookUrl: profileForm.facebookUrl,
        instagramUrl: profileForm.instagramUrl,
        linkedinUrl: profileForm.linkedinUrl,
        twitterUrl: profileForm.twitterUrl,
      },
      user: {
        firstName: profileForm.firstName,
        lastName: profileForm.lastName,
        phone: profileForm.phone,
        company: profileForm.company,
      }
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to save profile");
    }
    return response.json();
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["/api/agent/profile"] });
    setOriginalProfile(profileForm);
    setHasProfileChanges(false);
    toast({
      title: "Profile saved",
      description: "Your profile has been updated successfully.",
    });
  },
  onError: (error: Error) => {
    toast({
      title: "Error",
      description: error.message,
      variant: "destructive",
    });
  },
});
```

### Bio & Cover Letter Section JSX

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Sparkles, RefreshCw } from "lucide-react";

<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <FileText className="w-5 h-5" />
      Bio & Cover Letter
    </CardTitle>
    <CardDescription>
      Your biography and default cover letter for CMA reports
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* Agent Bio / Resume */}
    <div className="space-y-2">
      <Label htmlFor="bio">Agent Bio / Resume</Label>
      <Textarea 
        id="bio"
        placeholder="Tell clients about your experience, expertise, and what makes you the right agent for them..."
        value={profileForm.bio}
        onChange={(e) => setProfileForm(prev => ({ ...prev, bio: e.target.value }))}
        className="min-h-[120px]"
        data-testid="textarea-bio"
      />
      <p className="text-xs text-muted-foreground">
        This will appear on the Agent Resume page in your CMA reports
      </p>
    </div>
    
    {/* Default Cover Letter with AI Assistant */}
    <div className="space-y-3">
      <Label htmlFor="coverLetter">Default Cover Letter</Label>
      
      {/* AI Assistant Panel */}
      <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
            AI Assistant
          </span>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Tone Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Tone:</span>
            <Select 
              value={aiCoverLetterTone} 
              onValueChange={(v) => setAiCoverLetterTone(v as typeof aiCoverLetterTone)}
            >
              <SelectTrigger className="w-[140px] h-9" data-testid="select-ai-tone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="friendly">Friendly</SelectItem>
                <SelectItem value="confident">Confident</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Generate Button */}
          <Button
            type="button"
            onClick={handleGenerateCoverLetter}
            disabled={isGeneratingCoverLetter || !(profileForm.firstName || profileForm.lastName)}
            className="bg-purple-600 hover:bg-purple-700"
            size="sm"
            data-testid="button-generate-cover-letter"
          >
            {isGeneratingCoverLetter ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate with AI
              </>
            )}
          </Button>
        </div>
        
        {/* Helper text */}
        <p className="text-xs text-muted-foreground mt-2">
          {profileForm.defaultCoverLetter && profileForm.defaultCoverLetter.trim().length > 20
            ? "AI will enhance and improve your existing cover letter with the selected tone."
            : "AI will create a cover letter template based on your profile information above."
          }
        </p>
        
        {/* Warning if no name */}
        {!(profileForm.firstName || profileForm.lastName) && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            Fill in your name above to enable AI generation.
          </p>
        )}
      </div>
      
      {/* Cover Letter Textarea */}
      <Textarea 
        id="coverLetter"
        placeholder="Dear [Client Name],

Thank you for the opportunity to prepare this Comparative Market Analysis for your property. This report will help you understand the current market conditions and determine the best listing price for your home..."
        value={profileForm.defaultCoverLetter}
        onChange={(e) => setProfileForm(prev => ({ ...prev, defaultCoverLetter: e.target.value }))}
        className="min-h-[150px]"
        data-testid="textarea-cover-letter"
      />
      <p className="text-xs text-muted-foreground">
        This will be used as the default cover letter in your CMA presentations (can be customized per CMA)
      </p>
    </div>
  </CardContent>
</Card>
```

### Social & Web Links Section JSX

```tsx
import { Input } from "@/components/ui/input";
import { Globe } from "lucide-react";
import { SiFacebook, SiInstagram, SiLinkedin } from "react-icons/si";

<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <Globe className="w-5 h-5" />
      Social & Web Links
    </CardTitle>
    <CardDescription>
      Your website and social media links for reports
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    <div className="grid gap-4 md:grid-cols-2">
      {/* Website */}
      <div className="space-y-2">
        <Label htmlFor="websiteUrl" className="flex items-center gap-2">
          <Globe className="w-4 h-4" /> Website
        </Label>
        <Input 
          id="websiteUrl"
          placeholder="https://yourwebsite.com" 
          value={profileForm.websiteUrl}
          onChange={(e) => setProfileForm(prev => ({ ...prev, websiteUrl: e.target.value }))}
          data-testid="input-website" 
        />
      </div>
      
      {/* Facebook */}
      <div className="space-y-2">
        <Label htmlFor="facebookUrl" className="flex items-center gap-2">
          <SiFacebook className="w-4 h-4" /> Facebook
        </Label>
        <Input 
          id="facebookUrl"
          placeholder="https://facebook.com/yourpage" 
          value={profileForm.facebookUrl}
          onChange={(e) => setProfileForm(prev => ({ ...prev, facebookUrl: e.target.value }))}
          data-testid="input-facebook" 
        />
      </div>
      
      {/* Instagram */}
      <div className="space-y-2">
        <Label htmlFor="instagramUrl" className="flex items-center gap-2">
          <SiInstagram className="w-4 h-4" /> Instagram
        </Label>
        <Input 
          id="instagramUrl"
          placeholder="https://instagram.com/yourprofile" 
          value={profileForm.instagramUrl}
          onChange={(e) => setProfileForm(prev => ({ ...prev, instagramUrl: e.target.value }))}
          data-testid="input-instagram" 
        />
      </div>
      
      {/* LinkedIn */}
      <div className="space-y-2">
        <Label htmlFor="linkedinUrl" className="flex items-center gap-2">
          <SiLinkedin className="w-4 h-4" /> LinkedIn
        </Label>
        <Input 
          id="linkedinUrl"
          placeholder="https://linkedin.com/in/yourprofile" 
          value={profileForm.linkedinUrl}
          onChange={(e) => setProfileForm(prev => ({ ...prev, linkedinUrl: e.target.value }))}
          data-testid="input-linkedin" 
        />
      </div>
    </div>
  </CardContent>
</Card>
```

### Save/Reset Buttons

```tsx
import { RotateCcw, Loader2 } from "lucide-react";

<div className="flex justify-end gap-3">
  <Button 
    variant="outline" 
    onClick={() => {
      setProfileForm(originalProfile);
      setHasProfileChanges(false);
    }}
    disabled={!hasProfileChanges}
    data-testid="button-reset-profile"
  >
    <RotateCcw className="w-4 h-4 mr-2" />
    Reset Changes
  </Button>
  <Button 
    onClick={() => saveProfileMutation.mutate()}
    disabled={!hasProfileChanges || saveProfileMutation.isPending}
    data-testid="button-save-profile"
  >
    {saveProfileMutation.isPending ? (
      <>
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        Saving...
      </>
    ) : (
      'Save Profile'
    )}
  </Button>
</div>
```

---

## 6. Required Dependencies

```json
{
  "dependencies": {
    "@tanstack/react-query": "^5.x",
    "openai": "^4.x",
    "drizzle-orm": "^0.30.x",
    "drizzle-zod": "^0.5.x",
    "zod": "^3.x",
    "react-icons": "^5.x",
    "lucide-react": "^0.x"
  }
}
```

---

## 7. Environment Variables Required

```env
OPENAI_API_KEY=sk-your-openai-api-key
DATABASE_URL=postgresql://...
```

---

## Summary

This reference document contains:

1. **Database Schema** - Drizzle ORM table definition for `agent_profiles` with all social/bio fields
2. **Storage Interface** - CRUD operations for agent profiles with upsert behavior
3. **API Endpoints**:
   - `GET /api/agent/profile` - Fetch profile data
   - `PUT /api/agent/profile` - Update profile and user data
   - `POST /api/ai/generate-default-cover-letter` - AI cover letter generation
4. **OpenAI Client** - Complete prompt engineering for cover letter generation with tone selection
5. **React Components** - Full JSX for Bio & Cover Letter section and Social & Web Links section
6. **State Management** - TanStack Query integration with change tracking
