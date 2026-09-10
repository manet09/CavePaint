/* eslint-disable */
"use client";

import React from "react";
import { redirect } from "next/navigation";
import { use } from "react";

export default function ProjectIndex({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  redirect(`/projects/${id}/brainstorming`);
}
