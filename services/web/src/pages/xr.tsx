/**
 * XR Page (Task 96)
 *
 * Placeholder for AR/XR/Spatial computing features.
 * Future integration for immersive research visualization.
 */

import { useState } from 'react';
import {
  Glasses,
  Smartphone,
  Monitor,
  Box,
  Layers,
  Zap,
  ExternalLink,
  Bell,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const FEATURE_XR = import.meta.env.VITE_FEATURE_XR === 'true';

interface XRFeature {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  status: 'coming_soon' | 'beta' | 'available';
}

const XR_FEATURES: XRFeature[] = [
  {
    id: '3d_data_viz',
    title: '3D Data Visualization',
    description: 'Explore complex datasets in immersive 3D space',
    icon: Box,
    status: 'coming_soon',
  },
  {
    id: 'spatial_collaboration',
    title: 'Spatial Collaboration',
    description: 'Review research with remote team members in shared virtual spaces',
    icon: Layers,
    status: 'coming_soon',
  },
  {
    id: 'ar_annotations',
    title: 'AR Annotations',
    description: 'Overlay research notes on physical documents and lab equipment',
    icon: Glasses,
    status: 'coming_soon',
  },
  {
    id: 'vr_presentations',
    title: 'VR Presentations',
    description: 'Present research findings in immersive virtual environments',
    icon: Monitor,
    status: 'coming_soon',
  },
];

const SUPPORTED_DEVICES = [
  { name: 'Apple Vision Pro', icon: Glasses },
  { name: 'Meta Quest 3', icon: Glasses },
  { name: 'HoloLens 2', icon: Glasses },
  { name: 'ARKit (iOS)', icon: Smartphone },
  { name: 'ARCore (Android)', icon: Smartphone },
  { name: 'WebXR Browsers', icon: Monitor },
];

export function XRPage() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      // In production, this would submit to an API
      console.log('[XR] Waitlist signup:', email);
      setSubscribed(true);
      setEmail('');
    }
  };

  if (FEATURE_XR) {
    // Show actual XR features when enabled
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto p-6 space-y-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Glasses className="h-6 w-6" />
              XR Experience
            </h1>
            <p className="text-muted-foreground">
              Immersive research visualization and collaboration
            </p>
          </div>

          <Alert>
            <Zap className="h-4 w-4" />
            <AlertTitle>XR Mode Active</AlertTitle>
            <AlertDescription>
              XR features are enabled. Connect a compatible device to begin.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {XR_FEATURES.map((feature) => (
              <Card key={feature.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <feature.icon className="h-5 w-5" />
                    {feature.title}
                    <Badge variant="secondary" className="ml-auto">
                      {feature.status === 'coming_soon' ? 'Coming Soon' : feature.status}
                    </Badge>
                  </CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" disabled={feature.status === 'coming_soon'}>
                    {feature.status === 'coming_soon' ? 'Notify Me' : 'Launch'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Show coming soon page when feature is disabled
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6 space-y-8">
        {/* Hero */}
        <div className="text-center py-12">
          <div className="p-4 rounded-full bg-primary/10 w-24 h-24 mx-auto flex items-center justify-center mb-6">
            <Glasses className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-4xl font-bold mb-4">XR Research Experience</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            The future of research visualization is coming to ResearchFlow Canvas.
            Explore data in 3D, collaborate in virtual spaces, and present findings
            in immersive environments.
          </p>
        </div>

        {/* Features Preview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {XR_FEATURES.map((feature) => (
            <Card key={feature.id} className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <feature.icon className="h-5 w-5 text-primary" />
                  {feature.title}
                </CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* Supported Devices */}
        <Card>
          <CardHeader>
            <CardTitle>Supported Devices</CardTitle>
            <CardDescription>
              ResearchFlow XR will support a wide range of AR/VR platforms
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {SUPPORTED_DEVICES.map((device) => (
                <div
                  key={device.name}
                  className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg"
                >
                  <device.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{device.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Waitlist */}
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Join the Waitlist
            </CardTitle>
            <CardDescription>
              Be the first to experience XR research visualization
            </CardDescription>
          </CardHeader>
          <CardContent>
            {subscribed ? (
              <Alert>
                <AlertDescription>
                  Thanks for signing up! We'll notify you when XR features become available.
                </AlertDescription>
              </Alert>
            ) : (
              <form onSubmit={handleSubscribe} className="flex gap-2">
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1"
                  required
                />
                <Button type="submit">
                  Notify Me
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Learn More */}
        <div className="text-center">
          <Button variant="outline" asChild>
            <a
              href="https://docs.researchflow.io/xr"
              target="_blank"
              rel="noopener noreferrer"
            >
              Learn More About XR Features
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default XRPage;
