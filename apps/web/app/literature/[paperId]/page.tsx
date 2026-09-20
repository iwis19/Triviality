import { notFound, redirect } from "next/navigation";

export default async function LiteraturePaperPage({
  params,
}: {
  params: Promise<{ paperId: string }>;
}) {
  const { paperId } = await params;
  if (paperId === "compactness-in-finite-graphs") redirect("/dashboard/literature");
  notFound();
}
