import { Play, ArrowRight } from "lucide-react";
import heroImage from "../assets/hero-section-image.png";

import { Button } from "./ui/button";                       


const HeroSection = () => {
  return (
    <section className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-background/80" />
      
      {/* Content */}
      <div className="container mx-auto px-4 py-20 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left content */}
          <div className="text-center lg:text-left">
            <div className="inline-block px-4 py-2 rounded-full bg-card/50 border border-border mb-6">
              <span className="text-sm text-muted-foreground">✨ Transform your hiring process</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6 text-white">
              Revolutionize Your{" "}
              <span className="bg-hero-gradient bg-clip-text  text-purple-600">
                Interview Process
              </span>
            </h1>
            
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl">
              Streamline candidate screening with AI-powered video interviews, automated scheduling, 
              and comprehensive analytics. Make better hiring decisions faster.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Button variant="default" size="lg" className="group">
                Start Free Trial
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
              <Button variant="outline" size="lg" className="group text-accent-foreground">
                <Play className="mr-2 h-4 w-4" />
                Watch Demo
              </Button>
            </div>
            
            <div className="flex items-center justify-center lg:justify-start gap-8 mt-12 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-feature-schedule" />
                <span>No setup fees</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-feature-video" />
                <span>14-day free trial</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-feature-analytics" />
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>
          
          {/* Right content - Hero image */}
          <div className="relative">
            <div className="relative rounded-2xl overflow-hidden shadow-glow-secondary">
              <img src={heroImage} alt="" />
              {/* Overlay gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent" />
            </div>
            
            {/* Floating elements */}
            <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-primary/20 blur-xl animate-pulse" />
            <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full bg-feature-video/20 blur-xl animate-pulse delay-1000" />
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
