"use client";

import React from "react";
import { Header } from "@/components/Header";
import MyRoadmapDashboard from "@/components/learner/MyRoadmapDashboard";

export default function RoadmapPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
      <Header />
      <main className="pt-20 pb-12">
        <MyRoadmapDashboard />
      </main>
    </div>
  );
}
