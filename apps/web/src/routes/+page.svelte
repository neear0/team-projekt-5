<script lang="ts">
  import { rubrics } from '$lib/rubrics.ts';

  let repo_url = $state('');
  let rubric_id = $state(rubrics[0]?.id ?? '');

  function on_submit(event: SubmitEvent) {
    event.preventDefault();
    // Volanie @ooko/client pribudne v ďalšom kroku.
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
    />
  </label>

  <label>
    Rubrika (zadanie)
    <select bind:value={rubric_id}>
      {#each rubrics as rubric (rubric.id)}
        <option value={rubric.id}>{rubric.title}</option>
      {/each}
    </select>
  </label>

  <button type="submit">Analyzovať</button>
</form>
