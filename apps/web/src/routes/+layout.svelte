<script lang="ts">
  import '../app.css';

  let { children } = $props();

  async function logout() {
    await fetch('/api/logout', { method: 'POST' }).catch(() => undefined);
    location.href = '/login.html';
  }
</script>

<div class="shell">
  <header>
    <strong>ooko</strong>
    <span class="muted">Autonómny agent na kontrolu webových projektov</span>
    <button type="button" class="logout" onclick={logout}>Odhlásiť sa</button>
  </header>
  <main>
    {@render children()}
  </main>
</div>

<style>
  .shell {
    max-width: 640px;
    margin: 0 auto;
    padding: var(--space-6) var(--space-4) var(--space-8);
  }

  header {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
    margin-bottom: var(--space-6);
  }

  .muted {
    color: var(--color-text-muted);
    font-size: 0.9rem;
  }

  .logout {
    margin-left: auto;
    padding: 0;
    border: 0;
    background: none;
    color: var(--color-primary);
    font: inherit;
    font-size: 0.9rem;
    cursor: pointer;
  }
</style>
