import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Sparkles, 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  Loader2,
  Tv
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const DesignSystemShowcase: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');
  
  const triggerLoading = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 2000);
  };

  return (
    <div className="flex flex-col gap-8 pb-12 animate-slide-up">
      {/* Page Title */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Sparkles className="text-brand-primary animate-float h-5 w-5" />
          <h1 className="text-3xl font-extrabold text-content-primary tracking-tight">Design System Showcase</h1>
        </div>
        <p className="text-content-secondary text-sm">
          A living showcase to preview and validate the Shadcn-based premium UI elements and theme selectors.
        </p>
      </div>

      <Tabs defaultValue="buttons" className="w-full">
        <TabsList className="bg-surface-secondary border border-border-strong/45 p-0.5 rounded-lg h-9 w-full md:w-auto justify-start mb-6">
          <TabsTrigger id="tab-buttons" value="buttons" className="text-xs font-semibold px-4 py-1.5 data-[state=active]:bg-muted">
            Buttons & Badges
          </TabsTrigger>
          <TabsTrigger id="tab-cards" value="cards" className="text-xs font-semibold px-4 py-1.5 data-[state=active]:bg-muted">
            Cards & Alerts
          </TabsTrigger>
          <TabsTrigger id="tab-forms" value="forms" className="text-xs font-semibold px-4 py-1.5 data-[state=active]:bg-muted">
            Forms & Dialogs
          </TabsTrigger>
          <TabsTrigger id="tab-tables" value="tables" className="text-xs font-semibold px-4 py-1.5 data-[state=active]:bg-muted">
            Tables & Lists
          </TabsTrigger>
        </TabsList>

        {/* Buttons & Badges */}
        <TabsContent value="buttons" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Buttons Section */}
            <Card className="p-6 bg-card border-border-subtle flex flex-col gap-4">
              <h2 className="text-base font-bold text-content-primary mb-2 flex items-center gap-1.5">
                <Sparkles size={16} className="text-brand-primary" /> Buttons
              </h2>
              <div className="flex flex-wrap gap-3">
                <Button id="btn-default" variant="default" onClick={triggerLoading} disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Default Button
                </Button>
                <Button id="btn-secondary" variant="secondary">Secondary</Button>
                <Button id="btn-outline" variant="outline">Outline</Button>
                <Button id="btn-ghost" variant="ghost">Ghost</Button>
                <Button id="btn-destructive" variant="destructive">Destructive</Button>
                <Button id="btn-link" variant="link">Link Style</Button>
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-2">
                <Button variant="default" size="sm">Small size</Button>
                <Button variant="default" size="default">Default size</Button>
                <Button variant="default" size="lg">Large size</Button>
              </div>
            </Card>

            {/* Badges Section */}
            <Card className="p-6 bg-card border-border-subtle flex flex-col gap-4">
              <h2 className="text-base font-bold text-content-primary mb-2 flex items-center gap-1.5">
                <Layers size={16} className="text-brand-primary" /> Badges
              </h2>
              <div className="flex flex-wrap gap-2.5">
                <Badge variant="default">Default Badge</Badge>
                <Badge variant="secondary">Secondary Badge</Badge>
                <Badge variant="outline">Outline Badge</Badge>
                <Badge variant="destructive">Destructive Badge</Badge>
                
                {/* Custom Colored Badges */}
                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active
                </Badge>
                <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Warning
                </Badge>
                <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Info
                </Badge>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Cards & Alerts */}
        <TabsContent value="cards" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="p-6 bg-card border-border-subtle hover:border-brand-primary transition-all duration-300 group">
              <h3 className="text-sm font-bold text-content-primary group-hover:text-brand-primary transition-colors">Standard Card</h3>
              <p className="text-xs text-content-secondary mt-2">
                Standard dashboard container. Responsive, shadows scale based on color mode, borders glow on hover.
              </p>
            </Card>
            
            <Card className="p-6 bg-card border-border-subtle glass-card-base hover:shadow-md transition-all duration-300">
              <h3 className="text-sm font-bold text-content-primary">Glassmorphism Card</h3>
              <p className="text-xs text-content-secondary mt-2">
                Frosted background using backdrop-blur utilities. Highly premium look on dark gradients.
              </p>
            </Card>

            <Card className="p-6 bg-card border border-dashed border-border-strong/60 bg-card/40 flex flex-col items-center justify-center text-center p-8 min-h-[160px] rounded-xl">
              <Tv className="w-8 h-8 text-brand-primary mb-2" />
              <h4 className="text-xs font-bold text-content-primary m-0">Empty State State</h4>
              <p className="text-[10px] text-content-secondary mt-1 max-w-[200px] leading-relaxed">
                Used to highlight missing configurations.
              </p>
            </Card>
          </div>

          {/* Alerts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <div>
                <p className="text-emerald-800 dark:text-emerald-300 font-semibold text-xs m-0">Operation Completed</p>
                <p className="text-emerald-700/80 dark:text-emerald-400/85 text-[11px] m-0 mt-0.5">Success notification block styled with light background and success tones.</p>
              </div>
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <div>
                <p className="text-amber-800 dark:text-amber-300 font-semibold text-xs m-0">Attention Required</p>
                <p className="text-amber-700/80 dark:text-amber-400/85 text-[11px] m-0 mt-0.5">System warning block notifying the user about non-critical warnings.</p>
              </div>
            </div>

            <div className="rounded-xl border border-status-error/20 bg-status-error/5 p-4 flex gap-3">
              <AlertCircle className="h-5 w-5 text-status-error flex-shrink-0" />
              <div>
                <p className="text-red-800 dark:text-red-400 font-semibold text-xs m-0">Critical Error</p>
                <p className="text-red-700/80 dark:text-red-400/85 text-[11px] m-0 mt-0.5">Fatal action alerts or configuration errors that halt deployment.</p>
              </div>
            </div>

            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 flex gap-3">
              <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <div>
                <p className="text-blue-800 dark:text-blue-300 font-semibold text-xs m-0">Information Tip</p>
                <p className="text-blue-700/80 dark:text-blue-400/85 text-[11px] m-0 mt-0.5">General info notice showcasing tips, hints, or references.</p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Forms & Dialogs */}
        <TabsContent value="forms" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6 bg-card border-border-subtle flex flex-col gap-4">
              <h2 className="text-base font-bold text-content-primary mb-2">Input Fields</h2>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider">Default Text Input</label>
                  <Input 
                    type="text" 
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Enter text..." 
                    className="bg-surface-secondary border-border-strong/40 text-xs"
                  />
                </div>
                
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider">Error Validation Input</label>
                  <Input 
                    type="text" 
                    placeholder="Invalid value..." 
                    className="bg-surface-secondary border-status-error/50 focus-visible:ring-status-error/20 text-xs"
                  />
                  <span className="text-[10px] text-status-error font-medium">Please enter a valid ARN format.</span>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-card border-border-subtle flex flex-col justify-center items-center gap-4 text-center">
              <h2 className="text-base font-bold text-content-primary m-0">Overlay Dialogs</h2>
              <p className="text-xs text-content-secondary max-w-sm">
                Open overlays inside modern Shadcn Dialog primitives, fully backing transition triggers.
              </p>
              
              <Dialog>
                <DialogTrigger asChild>
                  <Button id="btn-dialog-trigger" className="cursor-pointer">Open Demo Dialog</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Confirm Action</DialogTitle>
                    <DialogDescription>
                      This dialog is styled using Shadcn and aligns perfectly with dynamic color theme updates.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <Input id="name" placeholder="Enter verification text..." />
                  </div>
                  <DialogFooter>
                    <Button type="submit">Verify</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </Card>
          </div>
        </TabsContent>

        {/* Tables */}
        <TabsContent value="tables" className="space-y-6">
          <Card className="bg-card border-border-subtle overflow-hidden">
            <div className="px-6 py-4 border-b border-border-subtle bg-muted/10">
              <h2 className="text-base font-bold text-content-primary m-0">Standard Data Table</h2>
            </div>
            <Table>
              <TableHeader className="bg-muted/40 border-b border-border-subtle">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold text-xs text-content-secondary uppercase tracking-wider py-3 px-4">Service</TableHead>
                  <TableHead className="font-semibold text-xs text-content-secondary uppercase tracking-wider py-3 px-4">Status</TableHead>
                  <TableHead className="font-semibold text-xs text-content-secondary uppercase tracking-wider py-3 px-4">Metric</TableHead>
                  <TableHead className="font-semibold text-xs text-content-secondary uppercase tracking-wider py-3 px-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { name: "SQS Messaging Service", status: "Active", metric: "450 messages/sec", statusColor: "text-emerald-500 bg-emerald-500/10 border-emerald-500/25" },
                  { name: "ECS Cluster Services", status: "Provisioning", metric: "2 tasks starting", statusColor: "text-blue-500 bg-blue-500/10 border-blue-500/25" },
                  { name: "ECR Image Repositories", status: "Inactive", metric: "12 images cached", statusColor: "text-content-muted bg-muted border-border/40" },
                ].map((item, idx) => (
                  <TableRow key={idx} className="group border-b border-border-subtle/50 last:border-0 hover:bg-muted/20">
                    <TableCell className="py-3 px-4 font-semibold text-xs text-content-primary">{item.name}</TableCell>
                    <TableCell className="py-3 px-4">
                      <Badge variant="outline" className={item.statusColor}>{item.status}</Badge>
                    </TableCell>
                    <TableCell className="py-3 px-4 text-xs font-mono text-content-secondary">{item.metric}</TableCell>
                    <TableCell className="py-3 px-4 text-right">
                      <Button variant="ghost" size="sm" className="h-7 px-3 text-brand-primary">View Details</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
