<script lang="ts">
  import type { LighthouseScores } from '@ooko/contracts';

  let { scores }: { scores: LighthouseScores } = $props();

  const labels: Record<keyof LighthouseScores, string> = {
    performance: 'Výkon',
    accessibility: 'Prístupnosť',
    best_practices: 'Best practices',
    seo: 'SEO',
  };

  function score_class(value: number): string {
    if (value >= 90) return 'good';
    if (value >= 50) return 'average';
    return 'poor';
  }
</script>

<div class="scores">
  {#each Object.entries(labels) as [key, label] (key)}
    <div class="tile score-{score_class(scores[key as keyof LighthouseScores])}">
      <span class="value">{scores[key as keyof LighthouseScores]}</span>
      <span class="label">{label}</span>
    </div>
  {/each}
</div>

<style>
  .scores {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
    gap: var(--space-3);
  }

  .tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
  }

  .value {
    font-size: 1.5rem;
    font-weight: 700;
  }

  .label {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    text-align: center;
  }

  .score-good .value {
    color: var(--color-success-text);
  }

  .score-average .value {
    color: var(--color-warning-text);
  }

  .score-poor .value {
    color: var(--color-error-text);
  }
</style>
