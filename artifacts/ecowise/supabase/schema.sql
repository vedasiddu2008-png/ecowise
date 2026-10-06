-- Run this script once in the Supabase SQL Editor for the EcoWise project.
-- Application requests use the public anon key together with the signed-in
-- user's access token; Row Level Security remains enabled for every private
-- table. A service-role key is not required by the application.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  avatar_url text,
  eco_score integer not null default 0 check (eco_score between 0 and 100),
  total_points integer not null default 0 check (total_points >= 0),
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  total_activities integer not null default 0 check (total_activities >= 0),
  preferred_category text,
  last_activity_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_preferred_category_check check (
    preferred_category is null or preferred_category in (
      'Transportation', 'Energy', 'Water', 'Food', 'Shopping', 'Waste',
      'Lifestyle', 'Other'
    )
  )
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  input_text text not null,
  category text not null check (category in (
    'Transportation', 'Energy', 'Water', 'Food', 'Shopping', 'Waste',
    'Lifestyle', 'Other'
  )),
  activity_name text not null,
  current_choice text not null,
  frequency text not null,
  impact_level text not null check (impact_level in ('Low', 'Medium', 'High')),
  analysis text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null,
  category text not null check (category in (
    'Transportation', 'Energy', 'Water', 'Food', 'Shopping', 'Waste',
    'Lifestyle', 'Other'
  )),
  difficulty text not null check (difficulty in ('Easy', 'Moderate', 'Challenging')),
  points integer not null check (points > 0),
  estimated_impact text not null,
  is_completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.completed_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recommendation_id uuid unique references public.recommendations(id) on delete set null,
  activity_id uuid references public.activities(id) on delete set null,
  points_earned integer not null check (points_earned >= 0),
  completed_at timestamptz not null default now()
);

create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null,
  icon text not null,
  requirement_type text not null,
  requirement_value integer not null check (requirement_value > 0)
);

create table if not exists public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_id uuid not null references public.badges(id) on delete cascade,
  earned_at timestamptz not null default now(),
  unique (user_id, badge_id)
);

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null unique,
  description text not null,
  category text check (category is null or category in (
    'Transportation', 'Energy', 'Water', 'Food', 'Shopping', 'Waste',
    'Lifestyle', 'Other'
  )),
  points integer not null check (points > 0),
  target_count integer not null check (target_count > 0),
  duration_days integer not null check (duration_days > 0),
  active boolean not null default true
);

create table if not exists public.user_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  progress integer not null default 0 check (progress >= 0),
  completed boolean not null default false,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, challenge_id)
);

create table if not exists public.daily_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_date date not null default current_date,
  points integer not null default 0 check (points >= 0),
  activity_count integer not null default 0 check (activity_count >= 0),
  unique (user_id, activity_date)
);

create index if not exists activities_user_created_idx
  on public.activities (user_id, created_at desc);
create index if not exists recommendations_user_completed_idx
  on public.recommendations (user_id, is_completed);
create index if not exists completed_activities_user_date_idx
  on public.completed_activities (user_id, completed_at desc);
create index if not exists daily_activity_user_date_idx
  on public.daily_activity (user_id, activity_date desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, '')
  )
  on conflict (id) do update
    set full_name = excluded.full_name,
        email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.badges (name, description, icon, requirement_type, requirement_value)
values
  ('Eco Beginner', 'Complete your first sustainable action.', 'leaf', 'activity_count', 1),
  ('Green Starter', 'Earn 100 eco points.', 'sprout', 'total_points', 100),
  ('Eco Warrior', 'Keep a 7-day sustainable streak.', 'flame', 'streak_days', 7),
  ('Waste Reducer', 'Complete 10 waste-reduction actions.', 'recycle', 'category:Waste', 10),
  ('Green Traveler', 'Complete 10 sustainable travel actions.', 'bike', 'category:Transportation', 10),
  ('Water Saver', 'Complete 10 water-saving actions.', 'droplets', 'category:Water', 10),
  ('Energy Saver', 'Complete 10 energy-saving actions.', 'zap', 'category:Energy', 10),
  ('Planet Protector', 'Earn 1,000 eco points.', 'globe-2', 'total_points', 1000),
  ('30 Day Champion', 'Keep a 30-day sustainable streak.', 'calendar-check', 'streak_days', 30),
  ('Sustainability Master', 'Complete 100 sustainable actions.', 'trophy', 'activity_count', 100)
on conflict (name) do update set
  description = excluded.description,
  icon = excluded.icon,
  requirement_type = excluded.requirement_type,
  requirement_value = excluded.requirement_value;

insert into public.challenges (title, description, category, points, target_count, duration_days, active)
values
  ('Green Travel Week', 'Choose a sustainable transportation option five times.', 'Transportation', 100, 5, 7, true),
  ('Plastic-Free Week', 'Choose a lower-waste alternative seven times.', 'Waste', 150, 7, 7, true),
  ('Save Energy Challenge', 'Complete five energy-saving actions.', 'Energy', 100, 5, 7, true),
  ('Water Saver Challenge', 'Complete five water-saving actions.', 'Water', 100, 5, 7, true),
  ('Walk More Challenge', 'Choose a greener trip three times.', 'Transportation', 75, 3, 7, true)
on conflict (title) do update set
  description = excluded.description,
  category = excluded.category,
  points = excluded.points,
  target_count = excluded.target_count,
  duration_days = excluded.duration_days,
  active = excluded.active;

alter table public.profiles enable row level security;
alter table public.activities enable row level security;
alter table public.recommendations enable row level security;
alter table public.completed_activities enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.challenges enable row level security;
alter table public.user_challenges enable row level security;
alter table public.daily_activity enable row level security;

grant select, insert on public.profiles to authenticated;
grant update (full_name, avatar_url, preferred_category)
  on public.profiles to authenticated;
grant select, insert on public.activities to authenticated;
grant select, insert on public.recommendations to authenticated;
grant select on public.completed_activities to authenticated;
grant select on public.badges to anon, authenticated;
grant select on public.user_badges to authenticated;
grant select on public.challenges to anon, authenticated;
grant select, insert on public.user_challenges to authenticated;
grant select on public.daily_activity to authenticated;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke insert on public.profiles from authenticated;
grant insert (id, full_name, email) on public.profiles to authenticated;
revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url, preferred_category)
  on public.profiles to authenticated;

drop policy if exists activities_select_own on public.activities;
create policy activities_select_own on public.activities for select to authenticated using (user_id = auth.uid());
drop policy if exists activities_insert_own on public.activities;
create policy activities_insert_own on public.activities for insert to authenticated with check (user_id = auth.uid());

drop policy if exists recommendations_select_own on public.recommendations;
create policy recommendations_select_own on public.recommendations for select to authenticated using (user_id = auth.uid());
drop policy if exists recommendations_insert_own on public.recommendations;
create policy recommendations_insert_own on public.recommendations for insert to authenticated with check (user_id = auth.uid());
drop policy if exists recommendations_update_own on public.recommendations;
create policy recommendations_update_own on public.recommendations for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on public.recommendations from authenticated;

drop policy if exists completed_activities_select_own on public.completed_activities;
create policy completed_activities_select_own on public.completed_activities for select to authenticated using (user_id = auth.uid());
drop policy if exists completed_activities_insert_own on public.completed_activities;
create policy completed_activities_insert_own on public.completed_activities for insert to authenticated with check (user_id = auth.uid());
revoke insert, update, delete on public.completed_activities from authenticated;

drop policy if exists badges_read_public on public.badges;
create policy badges_read_public on public.badges for select to anon, authenticated using (true);
drop policy if exists user_badges_select_own on public.user_badges;
create policy user_badges_select_own on public.user_badges for select to authenticated using (user_id = auth.uid());
drop policy if exists user_badges_insert_own on public.user_badges;
create policy user_badges_insert_own on public.user_badges for insert to authenticated with check (user_id = auth.uid());
revoke insert, update, delete on public.user_badges from authenticated;

drop policy if exists challenges_read_public on public.challenges;
create policy challenges_read_public on public.challenges for select to anon, authenticated using (active = true);
drop policy if exists user_challenges_select_own on public.user_challenges;
create policy user_challenges_select_own on public.user_challenges for select to authenticated using (user_id = auth.uid());
drop policy if exists user_challenges_insert_own on public.user_challenges;
create policy user_challenges_insert_own on public.user_challenges for insert to authenticated with check (user_id = auth.uid());
drop policy if exists user_challenges_update_own on public.user_challenges;
create policy user_challenges_update_own on public.user_challenges for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on public.user_challenges from authenticated;

drop policy if exists daily_activity_select_own on public.daily_activity;
create policy daily_activity_select_own on public.daily_activity for select to authenticated using (user_id = auth.uid());
drop policy if exists daily_activity_insert_own on public.daily_activity;
create policy daily_activity_insert_own on public.daily_activity for insert to authenticated with check (user_id = auth.uid());
drop policy if exists daily_activity_update_own on public.daily_activity;
create policy daily_activity_update_own on public.daily_activity for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke insert, update, delete on public.daily_activity from authenticated;

create or replace function public.complete_recommendation(p_recommendation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_recommendation public.recommendations%rowtype;
  v_profile public.profiles%rowtype;
  v_challenge record;
  v_challenge_points integer := 0;
  v_badge record;
  v_badge_progress integer;
  v_new_badge_ids uuid[] := '{}'::uuid[];
  v_new_badge_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  select * into v_recommendation
  from public.recommendations
  where id = p_recommendation_id
    and user_id = v_user_id
    and is_completed = false
  for update;

  if not found then
    raise exception 'recommendation_not_found_or_already_completed' using errcode = 'P0002';
  end if;

  update public.recommendations
  set is_completed = true
  where id = v_recommendation.id;

  insert into public.completed_activities
    (user_id, recommendation_id, activity_id, points_earned)
  values
    (v_user_id, v_recommendation.id, v_recommendation.activity_id, v_recommendation.points);

  for v_challenge in
    select uc.id as user_challenge_id, uc.progress, c.target_count, c.points
    from public.user_challenges uc
    join public.challenges c on c.id = uc.challenge_id
    where uc.user_id = v_user_id
      and uc.completed = false
      and c.active = true
      and (c.category is null or c.category = v_recommendation.category)
      and uc.started_at + make_interval(days => c.duration_days) >= now()
    for update of uc
  loop
    if v_challenge.progress + 1 >= v_challenge.target_count then
      update public.user_challenges
      set progress = v_challenge.target_count,
          completed = true,
          completed_at = now()
      where id = v_challenge.user_challenge_id;
      v_challenge_points := v_challenge_points + v_challenge.points;
    else
      update public.user_challenges
      set progress = v_challenge.progress + 1
      where id = v_challenge.user_challenge_id;
    end if;
  end loop;

  update public.profiles
  set total_points = total_points + v_recommendation.points + v_challenge_points,
      total_activities = total_activities + 1,
      eco_score = least(100, eco_score + greatest(1, floor(v_recommendation.points::numeric / 20)::integer)),
      current_streak = case
        when last_activity_date = current_date then current_streak
        when last_activity_date = current_date - 1 then current_streak + 1
        else 1
      end,
      longest_streak = greatest(
        longest_streak,
        case
          when last_activity_date = current_date then current_streak
          when last_activity_date = current_date - 1 then current_streak + 1
          else 1
        end
      ),
      last_activity_date = current_date
  where id = v_user_id
  returning * into v_profile;

  if not found then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;

  insert into public.daily_activity (user_id, activity_date, points, activity_count)
  values (
    v_user_id,
    current_date,
    v_recommendation.points + v_challenge_points,
    1
  )
  on conflict (user_id, activity_date) do update
    set points = public.daily_activity.points + excluded.points,
        activity_count = public.daily_activity.activity_count + 1;

  for v_badge in
    select * from public.badges
  loop
    case
      when v_badge.requirement_type = 'activity_count' then
        v_badge_progress := v_profile.total_activities;
      when v_badge.requirement_type = 'total_points' then
        v_badge_progress := v_profile.total_points;
      when v_badge.requirement_type = 'streak_days' then
        v_badge_progress := v_profile.current_streak;
      when v_badge.requirement_type like 'category:%' then
        select count(*)::integer into v_badge_progress
        from public.recommendations
        where user_id = v_user_id
          and is_completed = true
          and category = substring(v_badge.requirement_type from 10);
      else
        v_badge_progress := 0;
    end case;

    if v_badge_progress >= v_badge.requirement_value then
      insert into public.user_badges (user_id, badge_id)
      values (v_user_id, v_badge.id)
      on conflict (user_id, badge_id) do nothing
      returning badge_id into v_new_badge_id;

      if found then
        v_new_badge_ids := array_append(v_new_badge_ids, v_new_badge_id);
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'recommendation_id', v_recommendation.id,
    'new_badge_ids', to_jsonb(v_new_badge_ids),
    'challenge_bonus', v_challenge_points
  );
end;
$$;

revoke all on function public.complete_recommendation(uuid) from public, anon;
grant execute on function public.complete_recommendation(uuid) to authenticated;
