<script lang="ts">
  import type { CriterionResult } from '@ooko/contracts';
  import FindingList from './FindingList.svelte';

  let { criterion, repo_url }: { criterion: CriterionResult; repo_url: string } = $props();

  const score_class = $derived(
    criterion.points >= criterion.max_points ? 'full' : criterion.points <= 0 ? 'zero' : 'partial',
  );
</script>

<article class="criterion">
  <header>
    <h3>{criterion.title}</h3>
    <span class="score score-{score_class}">{criterion.points} / {criterion.max_points} b.</span>
  </header>
  <p class="reasoning">{criterion.reasoning}</p>
  <FindingList findings={criterion.findings} {repo_url} />
</article>

<style>
  .criterion {
    padding: var(--space-4);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--space-3);
    margin-bottom: var(--space-2);
  }

  h3 {
    font-size: 1rem;
  }

  .reasoning {
    margin: 0 0 var(--space-3);
    color: var(--color-text-muted);
    font-size: 0.9rem;
  }

  .score {
    flex: none;
    font-size: 0.85rem;
    font-weight: 600;
    white-space: nowrap;
  }

  .score-full {
    color: var(--color-success-text);
  }

  .score-partial {
    color: var(--color-warning-text);
  }

  .score-zero {
    color: var(--color-error-text);
  }
</style>
