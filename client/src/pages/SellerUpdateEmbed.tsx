import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";

// Form validation schema
const embedFormSchema = z.object({
  userId: z.string().default("guest"),
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  postalCode: z.string().min(5, "Valid postal code is required"),
  elementarySchool: z.string().optional(),
  propertySubType: z.string().optional(),
  emailFrequency: z.enum(["daily", "weekly", "bi-weekly", "monthly"]),
  isActive: z.boolean().default(true),
});

type EmbedFormValues = z.infer<typeof embedFormSchema>;

export default function SellerUpdateEmbed() {
  const [isSuccess, setIsSuccess] = useState(false);
  const [elementarySchoolSearch, setElementarySchoolSearch] = useState("");
  const [propertySubTypeSearch, setPropertySubTypeSearch] = useState("");

  const form = useForm<EmbedFormValues>({
    resolver: zodResolver(embedFormSchema),
    defaultValues: {
      userId: "guest",
      name: "",
      email: "",
      postalCode: "",
      elementarySchool: "",
      propertySubType: "",
      emailFrequency: "weekly",
      isActive: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: EmbedFormValues) => {
      // Ensure userId is included for guest user creation
      return await apiRequest("/api/seller-updates", "POST", {
        ...data,
        userId: "guest",
        isActive: true,
      });
    },
    onSuccess: () => {
      setIsSuccess(true);
      form.reset();
    },
  });

  const onSubmit = (data: EmbedFormValues) => {
    createMutation.mutate(data);
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl">You're All Set!</CardTitle>
            <CardDescription className="text-base">
              Your market update subscription has been created successfully.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              You'll receive your first market update soon based on your selected frequency.
            </p>
            <Button
              onClick={() => setIsSuccess(false)}
              className="w-full"
              data-testid="button-create-another"
            >
              Create Another Update
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">
            Get Market Updates for Your Area
          </CardTitle>
          <CardDescription className="text-base">
            Stay informed about new properties matching your criteria with automated email updates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Name and Email Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="John Doe" 
                          {...field} 
                          data-testid="input-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input 
                          type="email" 
                          placeholder="john@example.com" 
                          {...field} 
                          data-testid="input-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Zip Code and Email Frequency Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="postalCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Zip Code</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="90210" 
                          {...field} 
                          data-testid="input-postalCode"
                        />
                      </FormControl>
                      <FormDescription>
                        The area you want to monitor
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="emailFrequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Frequency</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-emailFrequency">
                            <SelectValue placeholder="Select frequency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="bi-weekly">Bi-Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        How often you want updates
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Optional Filters */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Optional Filters (Narrow your search)
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="elementarySchool"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Elementary School</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Lincoln Elementary"
                            {...field}
                            value={elementarySchoolSearch}
                            onChange={(e) => {
                              setElementarySchoolSearch(e.target.value);
                              field.onChange(e.target.value);
                            }}
                            data-testid="input-elementarySchool"
                          />
                        </FormControl>
                        <FormDescription>
                          Filter by school district
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="propertySubType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Property Type</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Single Family, Condo"
                            {...field}
                            value={propertySubTypeSearch}
                            onChange={(e) => {
                              setPropertySubTypeSearch(e.target.value);
                              field.onChange(e.target.value);
                            }}
                            data-testid="input-propertySubType"
                          />
                        </FormControl>
                        <FormDescription>
                          Filter by property type
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={createMutation.isPending}
                data-testid="button-submit"
              >
                {createMutation.isPending ? "Creating..." : "Start Receiving Updates"}
              </Button>

              {createMutation.isError && (
                <div className="text-sm text-destructive text-center" data-testid="text-error">
                  Failed to create update. Please try again.
                </div>
              )}
            </form>
          </Form>

          <div className="mt-6 pt-6 border-t text-center text-xs text-muted-foreground">
            <p>
              By subscribing, you agree to receive property market updates via email.
              You can unsubscribe at any time.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
