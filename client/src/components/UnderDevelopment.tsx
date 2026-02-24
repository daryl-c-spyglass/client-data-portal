import { Construction, AlertTriangle, ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface UnderDevelopmentProps {
  featureName?: string;
  message?: string;
}

export function UnderDevelopment({
  featureName = 'This feature',
  message = 'This feature is currently under development and will be available soon.',
}: UnderDevelopmentProps) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6" data-testid="under-development-page">
      <Card className="text-center max-w-md p-8">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-full mb-6 mx-auto">
          <Construction className="w-10 h-10 text-amber-600 dark:text-amber-400" />
        </div>

        <h1 className="text-2xl font-bold mb-3" data-testid="text-under-dev-title">Under Development</h1>

        <p className="text-muted-foreground mb-6" data-testid="text-under-dev-message">{message}</p>

        <Badge variant="outline" className="mb-8 gap-1.5 no-default-hover-elevate no-default-active-elevate">
          <AlertTriangle className="w-3.5 h-3.5" />
          Coming Soon
        </Badge>

        <div className="mt-4">
          <Link href="/">
            <Button variant="ghost" className="gap-2" data-testid="button-back-dashboard">
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
