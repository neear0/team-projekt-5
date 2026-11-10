<script lang="ts">
  import { ApiError, create_client, type Analysis } from '@ooko/client';
  import { rubrics } from '$lib/rubrics.ts';

  const client = create_client();

  let repo_url = $state('');
  let rubric_id = $state(rubrics[0]?.id ?? '');
  let running = $state(false);
  let analysis = $state<Analysis | null>(null);
  let error_message = $state<string | null>(null);

  let controller: AbortController | null = null;

  const selected_rubric = $derived(rubrics.find((r) => r.id === rubric_id) ?? null);

  async function on_submit(event: SubmitEvent) {
    event.preventDefault();
    if (!selected_rubric || running) return;

    running = true;
    error_message = null;
    analysis = null;
    controller = new AbortController();

    try {
      // AI vrstva pribudne neskôr, zatiaľ sa počítajú iba body za pravidlá.
      analysis = await client.analyze(
        { repo_url, rubric: selected_rubric, ai: { provider: 'none' } },
        { signal: controller.signal },
      );
    } catch (err) {
      // Rozlíšenie podľa err.code pribudne v ďalšom kroku, zatiaľ iba holá hláška.
      error_message = err instanceof ApiError ? err.message : 'Neočakávaná chyba. Skús to znova.';
    } finally {
      running = false;
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

<h1>ooko</h1>
<p>Autonómny agent na kontrolu webových projektov.</p>

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

  <button type="submit" disabled={running}>Analyzovať</button>
  {#if running}
    <button type="button" onclick={on_cancel}>Zrušiť</button>
  {/if}
</form>

<!-- Priebeh krokov a report sú v ďalších krokoch (6 a 8), toto je len holé overenie, že volanie funguje. -->
{#if error_message}
  <p>Chyba: {error_message}</p>
{/if}

{#if analysis}
  <p>Hotovo: {analysis.report.points} / {analysis.report.max_points} bodov.</p>
{/if}
