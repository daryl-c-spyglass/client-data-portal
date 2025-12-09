import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertSellerUpdateSchema } from "@shared/schema";
import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const formSchema = insertSellerUpdateSchema.extend({
  userId: z.string().default("demo-user-id"), // TODO: Replace with actual user ID from auth
});

export default function SellerUpdateNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [schoolSearch, setSchoolSearch] = useState("");
  const [schoolOpen, setSchoolOpen] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      userId: "demo-user-id",
      name: "",
      email: "",
      postalCode: "",
      elementarySchool: "",
      propertySubType: "",
      emailFrequency: "weekly",
      isActive: true,
    },
  });

  // Get property subtypes from properties
  const { data: propertyTypes } = useQuery<string[]>({
    queryKey: ['/api/properties/types'],
  });

  // School autocomplete - using the autocomplete endpoint
  const { data: schoolsResponse } = useQuery<{ suggestions: string[] }>({
    queryKey: ['/api/autocomplete/elementarySchools', schoolSearch],
    queryFn: async () => {
      const res = await fetch(`/api/autocomplete/elementarySchools?q=${encodeURIComponent(schoolSearch)}`);
      return res.json();
    },
    enabled: schoolSearch.length >= 2,
  });
  const schools = schoolsResponse?.suggestions || [];

  const createMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      // Convert "all" back to empty string for database storage
      const cleanedValues = {
        ...values,
        propertySubType: values.propertySubType === 'all' ? '' : values.propertySubType,
      };
      return await apiRequest('/api/seller-updates', 'POST', cleanedValues);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/seller-updates'] });
      toast({
        title: "Success!",
        description: "Seller update created successfully. Emails will be sent based on the frequency you selected.",
      });
      setLocation('/seller-updates');
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create seller update",
        variant: "destructive",
      });
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    createMutation.mutate(values);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Create Seller Update</h1>
        <p className="text-muted-foreground mt-1">
          Set up automated market update emails for sellers in a specific area
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Update Details</CardTitle>
          <CardDescription>
            Enter the criteria for properties to include in this automated update
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Name Field */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Update Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Downtown Austin Updates for Smith Family"
                        data-testid="input-name"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      A friendly name to identify this update
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Email Field */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="seller@example.com"
                        data-testid="input-email"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Where to send the automated updates
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="border-t pt-6">
                <h3 className="font-semibold mb-4">Property Criteria</h3>
                <div className="space-y-6">
                  {/* Zip Code Field */}
                  <FormField
                    control={form.control}
                    name="postalCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Zip Code *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="78745"
                            data-testid="input-postalcode"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Required - Properties in this zip code
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Elementary School Field (Autocomplete) */}
                  <FormField
                    control={form.control}
                    name="elementarySchool"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Elementary School</FormLabel>
                        <Popover open={schoolOpen} onOpenChange={setSchoolOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                className="w-full justify-between"
                                data-testid="input-elementaryschool"
                              >
                                {field.value || "Select school (optional)"}
                                <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0" align="start">
                            <Command>
                              <CommandInput
                                placeholder="Search schools..."
                                value={schoolSearch}
                                onValueChange={setSchoolSearch}
                              />
                              <CommandList>
                                <CommandEmpty>
                                  {schoolSearch.length < 2
                                    ? "Type at least 2 characters to search"
                                    : "No schools found"}
                                </CommandEmpty>
                                {schools && schools.length > 0 && (
                                  <CommandGroup>
                                    {schools.map((school) => (
                                      <CommandItem
                                        key={school}
                                        value={school}
                                        onSelect={() => {
                                          field.onChange(school);
                                          setSchoolOpen(false);
                                          setSchoolSearch("");
                                        }}
                                      >
                                        {school}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                )}
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormDescription>
                          Optional - Filter by elementary school
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Property Sub Type Field */}
                  <FormField
                    control={form.control}
                    name="propertySubType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Property Type</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value || ""}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-propertysubtype">
                              <SelectValue placeholder="Select type (optional)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            {propertyTypes && propertyTypes.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Optional - Filter by property subtype
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="font-semibold mb-4">Email Settings</h3>
                {/* Email Frequency Field */}
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
                          <SelectTrigger data-testid="select-emailfrequency">
                            <SelectValue />
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
                        How often to send market updates
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex gap-4">
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  data-testid="button-submit"
                >
                  {createMutation.isPending ? "Creating..." : "Create Seller Update"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation('/seller-updates')}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
