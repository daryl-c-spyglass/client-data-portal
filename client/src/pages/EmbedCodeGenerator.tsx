import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Check, Code2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function EmbedCodeGenerator() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [width, setWidth] = useState("600");
  const [height, setHeight] = useState("800");

  const baseUrl = window.location.origin;
  const embedUrl = `${baseUrl}/embed/seller-update`;

  const iframeCode = `<iframe
  src="${embedUrl}"
  width="${width}"
  height="${height}"
  frameborder="0"
  style="border: none; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);"
  title="Quick Seller Update Widget"
></iframe>`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(iframeCode);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Embed code copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to copy embed code",
        variant: "destructive",
      });
    }
  };

  const responsiveCode = `<!-- Responsive iframe that adapts to container width -->
<div style="position: relative; padding-bottom: 133%; height: 0; overflow: hidden; max-width: 600px; margin: 0 auto;">
  <iframe
    src="${embedUrl}"
    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none; border-radius: 8px;"
    frameborder="0"
    title="Quick Seller Update Widget"
  ></iframe>
</div>`;

  const wordpressCode = `<!-- Add this shortcode to any WordPress page or post -->
[iframe src="${embedUrl}" width="${width}" height="${height}"]

<!-- Or use this HTML block in Gutenberg editor -->
<iframe
  src="${embedUrl}"
  width="${width}"
  height="${height}"
  frameborder="0"
  style="border: none; border-radius: 8px;"
></iframe>`;

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Embed Code Generator</h1>
        <p className="text-muted-foreground mt-2">
          Generate embed code for the Quick Seller Update widget to place on your website or CRM.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code2 className="w-5 h-5" />
              Configuration
            </CardTitle>
            <CardDescription>
              Customize the widget dimensions for your website
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="width">Width (pixels)</Label>
              <Input
                id="width"
                type="number"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                min="300"
                max="1200"
                data-testid="input-width"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="height">Height (pixels)</Label>
              <Input
                id="height"
                type="number"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                min="600"
                max="1200"
                data-testid="input-height"
              />
            </div>

            <div className="pt-4 border-t space-y-2">
              <h4 className="font-medium text-sm">Preview URL</h4>
              <div className="flex gap-2">
                <Input
                  value={embedUrl}
                  readOnly
                  className="font-mono text-xs"
                  data-testid="input-embed-url"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(embedUrl, '_blank')}
                  data-testid="button-preview"
                >
                  Preview
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Live Preview</CardTitle>
            <CardDescription>
              See how the widget will look on your website
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted rounded-lg p-4 flex items-center justify-center min-h-[400px]">
              <iframe
                src={embedUrl}
                width={Math.min(parseInt(width), 400)}
                height={Math.min(parseInt(height), 500)}
                frameBorder="0"
                style={{
                  border: 'none',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                }}
                title="Quick Seller Update Widget Preview"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Embed Code */}
      <Card>
        <CardHeader>
          <CardTitle>Embed Code</CardTitle>
          <CardDescription>
            Copy and paste this code into your website or CRM
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="standard" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="standard">Standard</TabsTrigger>
              <TabsTrigger value="responsive">Responsive</TabsTrigger>
              <TabsTrigger value="wordpress">WordPress</TabsTrigger>
            </TabsList>

            <TabsContent value="standard" className="space-y-4">
              <div className="relative">
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs font-mono">
                  {iframeCode}
                </pre>
                <Button
                  size="sm"
                  variant="outline"
                  className="absolute top-2 right-2"
                  onClick={handleCopy}
                  data-testid="button-copy-standard"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Basic iframe embed that works on any website. Fixed width and height as configured above.
              </p>
            </TabsContent>

            <TabsContent value="responsive" className="space-y-4">
              <div className="relative">
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs font-mono">
                  {responsiveCode}
                </pre>
                <Button
                  size="sm"
                  variant="outline"
                  className="absolute top-2 right-2"
                  onClick={() => {
                    navigator.clipboard.writeText(responsiveCode);
                    setCopied(true);
                    toast({ title: "Copied!", description: "Responsive embed code copied" });
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  data-testid="button-copy-responsive"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Responsive embed that adapts to different screen sizes while maintaining aspect ratio.
              </p>
            </TabsContent>

            <TabsContent value="wordpress" className="space-y-4">
              <div className="relative">
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs font-mono">
                  {wordpressCode}
                </pre>
                <Button
                  size="sm"
                  variant="outline"
                  className="absolute top-2 right-2"
                  onClick={() => {
                    navigator.clipboard.writeText(wordpressCode);
                    setCopied(true);
                    toast({ title: "Copied!", description: "WordPress embed code copied" });
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  data-testid="button-copy-wordpress"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Code optimized for WordPress sites. Use the shortcode or HTML block depending on your theme.
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Usage Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">For Standard Websites</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>Copy the standard or responsive embed code above</li>
              <li>Paste it into your website's HTML where you want the widget to appear</li>
              <li>Save and publish your changes</li>
            </ol>
          </div>

          <div>
            <h4 className="font-medium mb-2">For WordPress Sites</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>Create or edit a page/post in WordPress</li>
              <li>Add a "Custom HTML" block or use the shortcode in a text widget</li>
              <li>Paste the WordPress embed code</li>
              <li>Preview and publish</li>
            </ol>
          </div>

          <div>
            <h4 className="font-medium mb-2">For CRM Systems</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>Locate the HTML/Custom Code section in your CRM</li>
              <li>Paste the standard iframe code</li>
              <li>Adjust width and height if needed to fit your CRM layout</li>
              <li>Save and test the integration</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
