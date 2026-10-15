// Supabase Edge Function: рассылка push-напоминаний о пропущенных тренировках.
// Запуск: cron-задача (Supabase → Database → Webhooks/pg_cron) или ручной fetch.
// Требуемые секреты (supabase secrets set):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Логика: для каждого активного пользователя, у которого включены напоминания
// (profiles.push_reminders_enabled = true) и нет тренировки за последние 24 часа,
// отправляем push на все его активные подписки из таблицы push_subscriptions.
//
// Подписка сохраняется клиентом (src/services/pushService.ts) в формате:
// { endpoint, keys: { p256dh, auth }, user_id, active }

import DenoShim from 'https://esm.sh/web-push@3.5.2';

interface PushSubscriptionRow {
  endpoint: string;
  keys: { p256dh: string; auth: string } | null;
  user_id: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

DenoShim.setVapidDetails(
  'mailto:burdinart@gmail.com',
  Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
  Deno.env.get('VAPID_PRIVATE_KEY') ?? '',
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Missing server secrets' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

  // 1. Пользователи с включёнными напоминаниями.
  const profilesRes = await fetch(
    `${supabaseUrl}/rest/v1/profiles?select=id,name,push_reminders_enabled&push_reminders_enabled=eq.true`,
    { headers },
  );
  const profiles = (await profilesRes.json()) as { id: string; name: string }[];

  let sent = 0;
  const errors: string[] = [];

  for (const profile of profiles) {
    // 2. Была ли тренировка за последние 24 часа — если да, не напоминаем.
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const workoutsRes = await fetch(
      `${supabaseUrl}/rest/v1/workout_sessions?select=id&user_id=eq.${profile.id}&started_at=gte.${since}&limit=1`,
      { headers },
    );
    const workouts = (await workoutsRes.json()) as unknown[];
    if (workouts.length > 0) continue;

    // 3. Активные подписки пользователя.
    const subsRes = await fetch(
      `${supabaseUrl}/rest/v1/push_subscriptions?select=endpoint,keys,user_id&user_id=eq.${profile.id}&active=eq.true`,
      { headers },
    );
    const subs = (await subsRes.json()) as PushSubscriptionRow[];

    const payload = JSON.stringify({
      title: 'FitTracker 💪',
      body: `${profile.name || 'Привет'}, сегодня ещё не было тренировки. Самое время!`,
      url: '/fit-tracker/',
    });

    for (const sub of subs) {
      try {
        await DenoShim.sendNotification(sub as never, payload);
        sent += 1;
      } catch (error) {
        // 404/410 — подписка протухла, деактивируем её.
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await fetch(
            `${supabaseUrl}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(sub.endpoint)}`,
            { method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ active: false }) },
          );
        } else {
          errors.push(String((error as Error).message));
        }
      }
    }
  }

  return new Response(JSON.stringify({ sent, errors }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
