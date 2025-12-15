import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, TrendingUp, PieChart, LineChart, Activity, Target, Clock, DollarSign } from "lucide-react";

export default function Analytics() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <BarChart3 className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">Analytics</h1>
          <p className="text-muted-foreground">
            Track your performance and market insights
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
            The Analytics feature is currently in development. Here's what you'll be able to track:
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Comprehensive analytics to help you understand your business performance and market trends at a glance.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="opacity-75">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-base">Lead Metrics</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Track lead sources, conversion rates, and response times. Understand which channels bring the best clients.
            </p>
          </CardContent>
        </Card>

        <Card className="opacity-75">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <CardTitle className="text-base">Market Trends</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Visualize price trends, inventory levels, and days on market across your focus areas and neighborhoods.
            </p>
          </CardContent>
        </Card>

        <Card className="opacity-75">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <PieChart className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <CardTitle className="text-base">CMA Insights</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              See aggregated data from your CMAs including price recommendations vs. actual sale prices.
            </p>
          </CardContent>
        </Card>

        <Card className="opacity-75">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <DollarSign className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <CardTitle className="text-base">Commission Tracker</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Monitor pending and closed commissions. Forecast your income based on active pipeline deals.
            </p>
          </CardContent>
        </Card>

        <Card className="opacity-75">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
            <div className="p-2 bg-pink-100 dark:bg-pink-900/30 rounded-lg">
              <LineChart className="h-5 w-5 text-pink-600 dark:text-pink-400" />
            </div>
            <div>
              <CardTitle className="text-base">Performance Dashboard</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Compare your performance month-over-month and year-over-year with beautiful visualizations.
            </p>
          </CardContent>
        </Card>

        <Card className="opacity-75">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
            <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
              <Target className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div>
              <CardTitle className="text-base">Goal Setting</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Set and track quarterly and annual goals for closings, volume, and lead generation activities.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
