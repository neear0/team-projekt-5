<script lang="ts">
  import { onMount } from 'svelte';
  import { ApiError, create_client, type Analysis } from '@ooko/client';
  import type { AiConfig } from '@ooko/contracts';
  import { rubrics } from '$lib/rubrics.ts';
  import ReportView from '$lib/report/ReportView.svelte';

  const client = create_client();

  const STEP_LABELS = {
    static: 'Kontrolujem HTML, CSS a JS…',
    runtime: 'Otváram web v prehliadači (screenshoty, prístupnosť, Lighthouse)…',
    ai: 'AI hodnotí kritériá…',
  } as const;

  let repo_url = $state('');
  let rubric_id = $state(rubrics[0]?.id ?? '');
  let running = $state(false);
  let analysis = $state<Analysis | null>(null);
  let error_message = $state<string | null>(null);
  let progress = $state<string | null>(null);
  /** Server má vlastný kľúč pre AI (GEMINI_API_KEY), inak sa hodnotí bez AI. */
  let server_ai = $state(false);

  let controller: AbortController | null = null;

  const selected_rubric = $derived(rubrics.find((r) => r.id === rubric_id) ?? null);
  const ai_config = $derived<AiConfig>(server_ai ? { provider: 'server' } : { provider: 'none' });

  /** Prihlásenie vypršalo: späť na prihlásenie a potom sem. */
  function go_to_login() {
    location.href = `/login.html?next=${encodeURIComponent(location.pathname)}`;
  }

  onMount(() => {
    client
      .health()
      .then((health) => {
        server_ai = health.server_ai;
      })
      .catch(() => {
        server_ai = false;
      });
  });

  async function on_submit(event: SubmitEvent) {
    event.preventDefault();
    if (!selected_rubric || running) return;

    running = true;
    error_message = null;
    analysis = null;
    controller = new AbortController();

    try {
      analysis = await client.analyze(
        { repo_url, rubric: selected_rubric, ai: ai_config },
        {
          signal: controller.signal,
          on_progress: (step, state) => {
            if (state === 'running') progress = STEP_LABELS[step];
          },
        },
      );
    } catch (err) {
      if (err instanceof ApiError && err.code === 'unauthorized') {
        go_to_login();
        return;
      }
      error_message = err instanceof ApiError ? err.message : 'Neočakávaná chyba. Skús to znova.';
    } finally {
      running = false;
      progress = null;
      controller = null;
    }
  }

  function on_cancel() {
    controller?.abort();
  }
</script>

<svelte:head>
  <title>ooko</title>
</svelte:head>

<section class="card">
  <h1>Analýza repozitára</h1>
  <form onsubmit={on_submit}>
    <label>
      Repozitár na GitHube
      <input
        type="url"
        bind:value={repo_url}
        placeholder="https://github.com/vlastnik/repo"
        required
        disabled={running}
      />
    </label>

    <label>
      Rubrika (zadanie)
      <select bind:value={rubric_id} disabled={running}>
        {#each rubrics as rubric (rubric.id)}
          <option value={rubric.id}>{rubric.title}</option>
        {/each}
      </select>
    </label>

    <p class="hint">
      {server_ai
        ? 'AI hodnotenie je zapnuté (model servera).'
        : 'AI hodnotenie je vypnuté, body sú iba za pravidlá overené nástrojmi.'}
    </p>

    <div class="actions">
      <button type="submit" disabled={running}>Analyzovať</button>
      {#if running}
        <button type="button" class="secondary" onclick={on_cancel}>Zrušiť</button>
      {/if}
    </div>
  </form>
</section>

{#if progress}
  <p class="banner info" aria-live="polite">{progress}</p>
{/if}

{#if error_message}
  <p class="banner error">{error_message}</p>
{/if}

{#if analysis}
  <ReportView {analysis} />
{/if}

<style>
  .card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: var(--space-4);
  }

  .card h1 {
    font-size: 1.25rem;
    margin-bottom: var(--space-4);
  }

  form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  label {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    font-size: 0.9rem;
  }

  input,
  select {
    padding: var(--space-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    font-size: 1rem;
    background: var(--color-surface);
    color: var(--color-text);
  }

  .actions {
    display: flex;
    gap: var(--space-3);
  }

  button {
    padding: var(--space-2) var(--space-4);
    border: 1px solid var(--color-primary);
    border-radius: var(--radius);
    background: var(--color-primary);
    color: var(--color-primary-contrast);
    font-size: 1rem;
    cursor: pointer;
  }

  button.secondary {
    background: transparent;
    color: var(--color-primary);
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .banner {
    margin-top: var(--space-4);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius);
    border: 1px solid;
  }

  .banner.error {
    background: var(--color-error-bg);
    border-color: var(--color-error-border);
    color: var(--color-error-text);
  }

  .banner.info {
    background: var(--color-info-bg);
    border-color: var(--color-info-border);
    color: var(--color-info-text);
  }

  .hint {
    margin: 0;
    font-size: 0.85rem;
    color: var(--color-text-muted);
  }
</style>
