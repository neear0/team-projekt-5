<script lang="ts">
  import { github_line_url } from '@ooko/client';
  import type { Finding } from '@ooko/contracts';

  let { findings, repo_url }: { findings: Finding[]; repo_url: string } = $props();

  const severity_label = { error: 'chyba', warning: 'upozornenie', info: 'info' } as const;
</script>

{#if findings.length > 0}
  <ul class="findings">
    {#each findings as finding, i (i)}
      <li>
        <span class="badge severity-{finding.severity}">{severity_label[finding.severity]}</span>
        <div class="body">
          <p class="message">{finding.message}</p>
          {#if finding.file}
            <a
              class="location"
              href={github_line_url(repo_url, finding.file, finding.line)}
              target="_blank"
              rel="noreferrer"
            >
              {finding.file}{finding.line ? `:${finding.line}` : ''}
            </a>
          {/if}
          {#if finding.hint}
            <p class="hint">{finding.hint}</p>
          {/if}
        </div>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .findings {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  li {
    display: flex;
    gap: var(--space-3);
    align-items: baseline;
  }

  .badge {
    flex: none;
    padding: 0.1rem var(--space-2);
    border-radius: var(--radius);
    font-size: 0.75rem;
    border: 1px solid;
  }

  .severity-error {
    background: var(--color-error-bg);
    border-color: var(--color-error-border);
    color: var(--color-error-text);
  }

  .severity-warning {
    background: var(--color-warning-bg);
    border-color: var(--color-warning-border);
    color: var(--color-warning-text);
  }

  .severity-info {
    background: var(--color-info-bg);
    border-color: var(--color-info-border);
    color: var(--color-info-text);
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .message {
    margin: 0;
  }

  .location {
    font-size: 0.85rem;
    color: var(--color-primary);
  }

  .hint {
    margin: 0;
    font-size: 0.85rem;
    color: var(--color-text-muted);
  }
</style>
