import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home, Compass } from "lucide-react";

const NotFound: React.FC = () => {
	const navigate = useNavigate();

	return (
		<div className="min-h-screen bg-background flex items-center justify-center p-4 mt-14">
			<div className="w-full max-w-md border border-border/80 rounded-[20px] bg-card p-8 text-center space-y-5">
				<div className="space-y-1">
					<h1 className="text-5xl font-bold tracking-[-0.03em] text-foreground">
						404
					</h1>
					<p className="text-[13px] text-muted-foreground">
						This page wandered off the stage.
					</p>
				</div>
				<div className="space-y-1.5">
					<h2 className="text-base font-bold text-foreground">
						Page not found
					</h2>
					<p className="text-[13px] text-muted-foreground">
						The page you're looking for doesn't exist or may have been
						moved.
					</p>
				</div>
				<div className="flex gap-3">
					<Button
						variant="outline"
						className="flex-1 font-semibold gap-2"
						onClick={() => navigate(-1)}
					>
						<Compass className="w-3.5 h-3.5" />
						Go Back
					</Button>
					<Button
						className="flex-1 font-semibold gap-2"
						onClick={() => navigate("/")}
					>
						<Home className="w-3.5 h-3.5" />
						Home
					</Button>
				</div>
			</div>
		</div>
	);
};

export default NotFound;
