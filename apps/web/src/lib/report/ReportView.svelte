<script lang="ts">
  import { group_criteria, type Analysis } from '@ooko/client';
  import CriterionCard from './CriterionCard.svelte';
  import LighthouseScores from './LighthouseScores.svelte';

  let { analysis }: { analysis: Analysis } = $props();

  const report = $derived(analysis.report);
  const groups = $derived(group_criteria(report.criteria));
</script>

<section class="report">
  <header>
    <h2>{report.rubric.title}</h2>
    <span class="score">{report.points} / {report.max_points} b.</span>
  </header>

  {#if report.summary}
    <p class="summary">{report.summary}</p>
  {/if}

  {#if report.lighthouse}
    <LighthouseScores scores={report.lighthouse} />
  {/if}

  {#each groups as group (group.title ?? '')}
    <div class="group">
      {#if group.title}
        <h3 class="group-title">
          {group.title}
          <span class="group-score">{group.points} / {group.max_points} b.</span>
        </h3>
      {/if}
      <div class="criteria">
        {#each group.criteria as criterion (criterion.id)}
          <CriterionCard {criterion} repo_url={report.repo_url} />
        {/each}
      </div>
    </div>
  {/each}
</section>

<style>
  .report {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--space-3);
  }

  .score {
    flex: none;
    font-size: 1.1rem;
    font-weight: 700;
    white-space: nowrap;
  }

  .summary {
    margin: 0;
    color: var(--color-text-muted);
  }

  .group {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .group-title {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--space-3);
    font-size: 1rem;
  }

  .group-score {
    font-size: 0.85rem;
    color: var(--color-text-muted);
  }

  .criteria {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
</style>
