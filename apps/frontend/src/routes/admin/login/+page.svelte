<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { ArrowLeft, ArrowRight, Compass, Eye, EyeOff, LoaderCircle, LockKeyhole, ShieldCheck } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { api } from '$lib/admin/api/client';

  let email = $state('');
  let password = $state('');
  let showPassword = $state(false);
  let loading = $state(false);
  let error = $state('');
  const clearSession = () => ['admin_token', 'admin_user', 'admin_permissions'].forEach(key => localStorage.removeItem(key));

  async function signIn(event: SubmitEvent) {
    event.preventDefault();
    if (loading) return;
    loading = true;
    error = '';
    try {
      const response = await api.auth.login({ email: email.trim().toLowerCase(), password });
      localStorage.setItem('admin_token', response.data.token);
      localStorage.setItem('admin_user', JSON.stringify(response.data.user));
      localStorage.setItem('admin_permissions', JSON.stringify(response.data.user.role === 'super_admin' ? ['*'] : []));
      password = '';
      await goto('/admin');
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Unable to sign in. Please try again.';
    } finally { loading = false; }
  }

  onMount(async () => {
    if (!localStorage.getItem('admin_token')) return;
    try { await api.auth.me(); await goto('/admin'); }
    catch { clearSession(); }
  });
</script>

<svelte:head><title>Sign in | Key2africa CMS</title></svelte:head>

<main class="login-page">
  <aside class="login-story" aria-label="Key2africa Safaris">
    <img src="/images/safari-hero.jpg" alt="The golden landscapes of a Tanzania safari" />
    <div class="story-shade"></div>
    <a class="story-brand" href="/" aria-label="Key2africa Safaris home"><span><Compass size={25} strokeWidth={1.5} /></span><div><strong>Key2africa</strong><small>SAFARIS</small></div></a>
    <div class="story-copy"><p>BEHIND EVERY GREAT JOURNEY</p><h1>A little planning.<br />A world of possibility.</h1><div class="story-line"></div><span>Bring your safari stories, experiences and guest journeys together in one place.</span></div>
    <p class="story-footer">Key2africa Tours and Safaris ltd</p>
  </aside>
  <section class="login-form-side" aria-labelledby="login-title">
    <a class="back-link" href="/"><ArrowLeft size={15} /> Back to website</a>
    <div class="login-card">
      <div class="login-mark"><LockKeyhole size={23} strokeWidth={1.6} /></div>
      <p class="login-eyebrow">KEY2AFRICA · ADMIN</p>
      <h2 id="login-title">Welcome back.</h2>
      <p class="login-description">Sign in to manage your website and safari enquiries.</p>
      {#if page.url.searchParams.get('reason') === 'timeout'}<p class="login-notice" role="status">Your session ended after a period of inactivity. Please sign in again.</p>{/if}
      <form onsubmit={signIn} class="login-form">
        <div class="field"><Label for="admin-email">Email address</Label><Input id="admin-email" name="email" type="email" autocomplete="username" placeholder="you@example.com" bind:value={email} required class="h-12 rounded-xl bg-white px-4" /></div>
        <div class="field"><Label for="admin-password">Password</Label><div class="password-wrap"><Input id="admin-password" name="password" type={showPassword ? 'text' : 'password'} autocomplete="current-password" placeholder="Enter your password" bind:value={password} required minlength={8} class="h-12 rounded-xl bg-white pl-4 pr-12" /><Button type="button" variant="ghost" size="icon" class="absolute top-1 right-1 size-10 rounded-lg" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onclick={() => showPassword = !showPassword}>{#if showPassword}<EyeOff size={18} />{:else}<Eye size={18} />{/if}</Button></div></div>
        {#if error}<p class="login-error" role="alert">{error}</p>{/if}
        <Button type="submit" variant="safari" class="mt-2 h-12 w-full rounded-xl" disabled={loading}>{#if loading}<LoaderCircle class="size-4 animate-spin" /> Signing in…{:else}Sign in <ArrowRight size={18} />{/if}</Button>
      </form>
      <p class="login-security"><ShieldCheck size={15} /> Access for authorized team members</p>
    </div>
    <p class="login-copyright">© {new Date().getFullYear()} Key2africa Tours and Safaris ltd</p>
  </section>
</main>

<style>
  .login-page { display:grid; min-height:100dvh; grid-template-columns:1fr 1fr; background:#f8fafc; }
  .login-story { position:relative; display:flex; flex-direction:column; min-height:100dvh; padding:48px; overflow:hidden; color:white; background:var(--navy); }
  .login-story > img,.story-shade { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
  .story-shade { background:linear-gradient(180deg,rgb(8 25 41 / .42),rgb(8 25 41 / .25) 25%,rgb(8 25 41 / .88)); }
  .story-brand { position:relative; display:flex; align-items:center; gap:13px; width:fit-content; color:white; }
  .story-brand > span { display:grid; place-items:center; width:50px; height:50px; border:1px solid rgb(246 210 27 / .85); border-radius:50%; color:#f6d21b; }
  .story-brand strong { display:block; font-size:23px; line-height:1.2; letter-spacing:-.6px; }
  .story-brand small { display:block; margin-top:5px; font-size:9px; letter-spacing:3px; }
  .story-copy { position:relative; margin-top:auto; padding-top:160px; max-width:490px; }
  .story-copy > p { margin-bottom:22px; font-size:10px; font-weight:600; letter-spacing:2.5px; color:#f6d21b; }
  .story-copy h1 { font-size:clamp(30px,3.3vw,48px); line-height:1.2; font-weight:600; letter-spacing:-1.8px; }
  .story-line { width:42px; height:3px; margin:27px 0 23px; background:#f6d21b; }
  .story-copy > span { display:block; max-width:350px; font-size:13px; line-height:1.9; color:rgb(255 255 255 / .75); }
  .story-footer { position:relative; margin-top:62px; font-size:10px; color:rgb(255 255 255 / .55); }
  .login-form-side { position:relative; display:flex; flex-direction:column; justify-content:center; padding:110px 48px; }
  .back-link { position:absolute; top:42px; left:48px; display:flex; align-items:center; gap:9px; font-size:12px; color:var(--muted-foreground); }
  .back-link:hover { color:var(--navy); }
  .login-card { width:100%; max-width:390px; margin:auto; }
  .login-mark { display:grid; place-items:center; width:52px; height:52px; margin-bottom:28px; border:1px solid var(--border); border-radius:15px; background:white; color:var(--navy); box-shadow:0 4px 12px rgb(15 45 78 / .04); }
  .login-eyebrow { margin-bottom:10px; color:var(--muted-foreground); font-size:10px; font-weight:600; letter-spacing:2px; }
  .login-card h2 { color:var(--navy); font-size:34px; font-weight:600; line-height:1.3; letter-spacing:-1px; }
  .login-description { margin-top:12px; color:var(--muted-foreground); font-size:13px; line-height:1.85; }
  .login-form { display:grid; gap:21px; margin-top:34px; }
  .field { display:grid; gap:9px; }
  .password-wrap { position:relative; }
  .login-error,.login-notice { padding:12px 14px; border-radius:10px; font-size:12px; line-height:1.7; background:#fef2f2; color:#b91c1c; border:1px solid #fecaca; }
  .login-notice { margin-top:20px; background:#fffbeb; color:#92400e; border-color:#fde68a; }
  .login-security { display:flex; justify-content:center; align-items:center; gap:7px; margin-top:27px; font-size:10px; color:var(--muted-foreground); }
  .login-copyright { position:absolute; bottom:30px; left:24px; right:24px; text-align:center; color:var(--muted-foreground); font-size:9px; }
  @media(max-width:900px) { .login-page { grid-template-columns:1fr; } .login-story { display:none; } .login-form-side { min-height:100dvh; padding:120px 24px 100px; } .back-link { top:32px; left:24px; } }
</style>
