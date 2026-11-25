import { Component, input } from '@angular/core';
@Component({
  selector: 'app-workspace-icon',
  standalone: true,
  templateUrl: './workspace-icon.html',
  styleUrl: './workspace-icon.css',
})
export class WorkspaceIcon {
  readonly name = input.required<string>();
  readonly paths: Record<string, string> = {
    summary: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
    clients:
      'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.87M15 3.13a4 4 0 0 1 0 7.75M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    cases: 'M8 7V4h8v3M3 7h18v14H3zM3 12a24 24 0 0 0 18 0M10 12h4',
    documents:
      'M14 2H8a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 2v6h6M3 6v14a2 2 0 0 0 2 2h10',
    ai: 'm10 3 2.5 6.5L19 12l-6.5 2.5L10 21l-2.5-6.5L1 12l6.5-2.5zM20 2v4M18 4h4M21 17v4M19 19h4',
    drafts:
      'M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14v-7M15 3l6 6M10 14l9-9 3 3-9 9-4 1zM7 7h2M7 11h2',
    summaries: 'M6 3h14v18H6zM3 6h4M3 10h4M3 14h4M3 18h4M10 7h6M10 11h6M10 15h4',
    citations: 'M4 5h16v16H4zM4 10h16M8 2v6M16 2v6m-8 8 3 3 5-6',
    users:
      'M3 21v-2a4 4 0 0 1 4-4h4M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M18 14l1 1 2 1-1 2 1 2-2 1-1 1-1-1-2-1 1-2-1-2 2-1z',
    roles: 'm12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6zm-4 10 3 3 5-6',
    audit: 'M3 11a9 9 0 1 1 2 7M3 3v8h8M12 7v6l4 2',
    reports: 'M3 3v18h18M7 16v-4M12 16V8M17 16v-6',
    tasks: 'M8 3h8v4H8zM8 5H4v16h16V5h-4M8 12l2 2 5-5M8 18h8',
    calendar: 'M4 5h16v16H4zM4 10h16M8 2v6M16 2v6M8 14h2M14 14h2M8 18h2',
    clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 7v6l4 2',
  };
}
