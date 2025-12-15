import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, UserPlus, Mail, Phone, Calendar, TrendingUp, Clock } from "lucide-react";

export default function Clients() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Users className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">Clients</h1>
          <p className="text-muted-foreground">
            Manage your buyer and seller relationships
          </p>
        </div>
        <Badge variant="secondary" className="text-sm">Coming Soon</Badge>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Feature Preview
          </CardTitle>
          <CardDescription>
            The Clients feature is currently in development. Here's what you'll be able to do:
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            A powerful client relationship management system designed specifically for real estate professionals.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="opacity-75">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <UserPlus className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-base">Client Profiles</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Store contact details, preferences, budget range, and property requirements for each client in one organized place.
            </p>
          </CardContent>
        </Card>

        <Card className="opacity-75">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Mail className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <CardTitle className="text-base">Saved Searches</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Create and save property searches for your clients. Get notified when new listings match their criteria.
            </p>
          </CardContent>
        </Card>

        <Card className="opacity-75">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Phone className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <CardTitle className="text-base">Activity Timeline</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Track all interactions, showings, and communications with each client in a chronological timeline.
            </p>
          </CardContent>
        </Card>

        <Card className="opacity-75">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <Calendar className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <CardTitle className="text-base">Showing Scheduler</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Schedule property showings and sync with your calendar. Send automatic reminders to clients.
            </p>
          </CardContent>
        </Card>

        <Card className="opacity-75">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
            <div className="p-2 bg-pink-100 dark:bg-pink-900/30 rounded-lg">
              <TrendingUp className="h-5 w-5 text-pink-600 dark:text-pink-400" />
            </div>
            <div>
              <CardTitle className="text-base">Pipeline View</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Visualize your client pipeline from lead to closing. Track deals at every stage of the transaction.
            </p>
          </CardContent>
        </Card>

        <Card className="opacity-75">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
            <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
              <Users className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div>
              <CardTitle className="text-base">Team Collaboration</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Share client notes and property recommendations with team members for seamless collaboration.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
