import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, Mail, Building, Users, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { demoRequestSchema, type DemoRequest } from "@packages/core/types";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

export function CTASection() {
  const { toast } = useToast();
  
  const form = useForm<DemoRequest>({
    resolver: zodResolver(demoRequestSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      institution: "",
      message: "",
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (data: DemoRequest) => {
      const response = await apiRequest("POST", "/api/demo/contact", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Request Received!",
        description: "We'll be in touch within 24 hours to schedule your demo.",
      });
      form.reset();
    },
    onError: () => {
      toast({
        title: "Something went wrong",
        description: "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: DemoRequest) => {
    submitMutation.mutate(data);
  };

  return (
    <section className="py-16 lg:py-24 bg-gradient-to-b from-ros-primary/5 via-ros-workflow/5 to-background">
      <div className="container mx-auto px-6 lg:px-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-ros-workflow/10 text-ros-workflow" data-testid="badge-cta-tagline">
              <Sparkles className="h-4 w-4" />
              <span className="text-sm font-medium">Transform Your Research Today</span>
            </div>
            
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-foreground leading-tight" data-testid="text-cta-heading">
              Ready to Accelerate Your Research?
            </h2>
            
            <p className="text-lg text-muted-foreground" data-testid="text-cta-description">
              Join hundreds of researchers who have transformed their workflow. 
              From clinicians to biologists, ResearchOps empowers non-technical 
              researchers to conduct data-driven studies without coding.
            </p>

            <div className="grid sm:grid-cols-2 gap-4 pt-4">
              <Card className="p-4 border-border/50 bg-card/50" data-testid="card-stat-researchers">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-ros-success/10 text-ros-success flex items-center justify-center">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" data-testid="text-stat-researchers-count">500+</p>
                    <p className="text-sm text-muted-foreground">Researchers</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4 border-border/50 bg-card/50" data-testid="card-stat-institutions">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-ros-primary/10 text-ros-primary flex items-center justify-center">
                    <Building className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" data-testid="text-stat-institutions-count">50+</p>
                    <p className="text-sm text-muted-foreground">Institutions</p>
                  </div>
                </div>
              </Card>
            </div>

            <div className="flex flex-wrap gap-4 pt-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="text-feature-trial">
                <div className="w-2 h-2 rounded-full bg-ros-success" />
                <span>Free 14-day trial</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="text-feature-no-card">
                <div className="w-2 h-2 rounded-full bg-ros-success" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="text-feature-support">
                <div className="w-2 h-2 rounded-full bg-ros-success" />
                <span>Dedicated support</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Card className="p-6 lg:p-8 border-border/50 shadow-lg" data-testid="card-demo-form">
              <h3 className="font-semibold text-xl mb-6" data-testid="text-form-heading">Request a Demo</h3>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="John" 
                              {...field}
                              data-testid="input-first-name"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Smith" 
                              {...field}
                              data-testid="input-last-name"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Work Email</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                              type="email" 
                              placeholder="john.smith@university.edu" 
                              className="pl-10"
                              {...field}
                              data-testid="input-email"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="institution"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Institution</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                              placeholder="University Medical Center" 
                              className="pl-10"
                              {...field}
                              data-testid="input-institution"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Research Focus (Optional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Tell us about your research area and what you're hoping to achieve..."
                            className="resize-none"
                            rows={3}
                            {...field}
                            data-testid="textarea-message"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit" 
                    className="w-full bg-ros-primary hover:bg-ros-primary/90 py-6 text-lg"
                    disabled={submitMutation.isPending}
                    data-testid="button-submit-demo"
                  >
                    {submitMutation.isPending ? "Submitting..." : "Request Demo"}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>

                  <p className="text-xs text-muted-foreground text-center" data-testid="text-terms-notice">
                    By submitting, you agree to our Terms of Service and Privacy Policy.
                  </p>
                </form>
              </Form>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
