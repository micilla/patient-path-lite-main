import { createFileRoute } from "@tanstack/react-router";
import { ClinicalApp } from "@/components/clinical/ClinicalApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Digital Clinical File Management System" },
      {
        name: "description",
        content: "A secure clinical CRUD app for patient records, lab results, visit notes, and document storage.",
      },
      { property: "og:title", content: "Digital Clinical File Management System" },
      {
        property: "og:description",
        content: "Manage patient records digitally with authentication, search, lab uploads, and visit notes.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return <ClinicalApp />;
}
