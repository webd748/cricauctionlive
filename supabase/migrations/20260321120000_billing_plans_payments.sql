begin;

create table if not exists public.billing_plans (
    plan_code text primary key,
    name text not null,
    max_teams integer not null check (max_teams > 0),
    amount_inr numeric not null check (amount_inr >= 0),
    description text not null default '',
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.billing_subscriptions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    plan_code text not null references public.billing_plans(plan_code),
    max_teams integer not null check (max_teams > 0),
    amount_inr numeric not null check (amount_inr >= 0),
    status text not null check (status in ('pending_payment', 'pending_review', 'active', 'rejected', 'expired')),
    selected_at timestamptz not null default now(),
    activated_at timestamptz,
    expires_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id)
);

create table if not exists public.billing_payment_proofs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    subscription_id uuid not null references public.billing_subscriptions(id) on delete cascade,
    plan_code text not null references public.billing_plans(plan_code),
    amount_inr numeric not null check (amount_inr >= 0),
    upi_ref text,
    screenshot_path text,
    status text not null check (status in ('submitted', 'approved', 'rejected')) default 'submitted',
    review_note text,
    reviewed_by uuid references auth.users(id) on delete set null,
    reviewed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists billing_subscriptions_user_status_idx
    on public.billing_subscriptions (user_id, status);

create index if not exists billing_subscriptions_status_idx
    on public.billing_subscriptions (status, updated_at desc);

create index if not exists billing_payment_proofs_sub_status_idx
    on public.billing_payment_proofs (subscription_id, status, created_at desc);

create index if not exists billing_payment_proofs_user_idx
    on public.billing_payment_proofs (user_id, created_at desc);

create or replace function public.touch_billing_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trg_touch_billing_plans on public.billing_plans;
create trigger trg_touch_billing_plans
before update on public.billing_plans
for each row execute function public.touch_billing_updated_at();

drop trigger if exists trg_touch_billing_subscriptions on public.billing_subscriptions;
create trigger trg_touch_billing_subscriptions
before update on public.billing_subscriptions
for each row execute function public.touch_billing_updated_at();

drop trigger if exists trg_touch_billing_payment_proofs on public.billing_payment_proofs;
create trigger trg_touch_billing_payment_proofs
before update on public.billing_payment_proofs
for each row execute function public.touch_billing_updated_at();

insert into public.billing_plans (plan_code, name, max_teams, amount_inr, description, is_active)
values
    ('free', 'Free', 4, 0, 'Get started with a compact auction room', true),
    ('p2', 'P2', 8, 1999, 'Balanced setup for growing leagues', true),
    ('p3', 'P3', 12, 2599, 'Expanded capacity for larger tournaments', true),
    ('p4', 'P4', 16, 2999, 'High-capacity package for serious events', true),
    ('p5', 'P5', 32, 4599, 'Enterprise-scale control for mega auctions', true)
on conflict (plan_code) do update
set
    name = excluded.name,
    max_teams = excluded.max_teams,
    amount_inr = excluded.amount_inr,
    description = excluded.description,
    is_active = excluded.is_active,
    updated_at = now();

create or replace function public.select_billing_plan(p_plan_code text)
returns public.billing_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_plan public.billing_plans%rowtype;
    v_subscription public.billing_subscriptions%rowtype;
begin
    if v_uid is null then
        raise exception 'Authentication required.';
    end if;

    select *
    into v_plan
    from public.billing_plans
    where plan_code = p_plan_code
      and is_active = true
    limit 1;

    if not found then
        raise exception 'Invalid or inactive billing plan.';
    end if;

    insert into public.billing_subscriptions (
        user_id,
        plan_code,
        max_teams,
        amount_inr,
        status,
        selected_at,
        activated_at,
        expires_at
    )
    values (
        v_uid,
        v_plan.plan_code,
        v_plan.max_teams,
        v_plan.amount_inr,
        'pending_payment',
        now(),
        null,
        null
    )
    on conflict (user_id) do update
    set
        plan_code = excluded.plan_code,
        max_teams = excluded.max_teams,
        amount_inr = excluded.amount_inr,
        status = 'pending_payment',
        selected_at = now(),
        activated_at = null,
        expires_at = null,
        updated_at = now()
    returning * into v_subscription;

    return v_subscription;
end;
$$;

create or replace function public.submit_payment_proof(
    p_upi_ref text,
    p_screenshot_path text,
    p_note text default null
)
returns public.billing_payment_proofs
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_subscription public.billing_subscriptions%rowtype;
    v_existing_pending integer;
    v_proof public.billing_payment_proofs%rowtype;
begin
    if v_uid is null then
        raise exception 'Authentication required.';
    end if;

    select *
    into v_subscription
    from public.billing_subscriptions
    where user_id = v_uid
    limit 1
    for update;

    if not found then
        raise exception 'Select a billing plan before payment.';
    end if;

    if v_subscription.status = 'active' and (v_subscription.expires_at is null or v_subscription.expires_at > now()) then
        raise exception 'Subscription is already active.';
    end if;

    select count(*) into v_existing_pending
    from public.billing_payment_proofs
    where subscription_id = v_subscription.id
      and status = 'submitted';

    if v_existing_pending > 0 then
        raise exception 'A payment proof is already pending review.';
    end if;

    insert into public.billing_payment_proofs (
        user_id,
        subscription_id,
        plan_code,
        amount_inr,
        upi_ref,
        screenshot_path,
        status,
        review_note
    )
    values (
        v_uid,
        v_subscription.id,
        v_subscription.plan_code,
        v_subscription.amount_inr,
        nullif(trim(coalesce(p_upi_ref, '')), ''),
        nullif(trim(coalesce(p_screenshot_path, '')), ''),
        'submitted',
        nullif(trim(coalesce(p_note, '')), '')
    )
    returning * into v_proof;

    update public.billing_subscriptions
    set status = 'pending_review',
        updated_at = now()
    where id = v_subscription.id;

    return v_proof;
end;
$$;

create or replace function public.approve_payment_proof(
    p_proof_id uuid,
    p_valid_days integer default 30
)
returns public.billing_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
    v_actor uuid := auth.uid();
    v_proof public.billing_payment_proofs%rowtype;
    v_subscription public.billing_subscriptions%rowtype;
    v_days integer := greatest(1, coalesce(p_valid_days, 30));
begin
    if not public.is_admin() then
        raise exception 'Admin access required.';
    end if;

    select *
    into v_proof
    from public.billing_payment_proofs
    where id = p_proof_id
    limit 1
    for update;

    if not found then
        raise exception 'Payment proof not found.';
    end if;

    if v_proof.status <> 'submitted' then
        raise exception 'Only submitted proofs can be approved.';
    end if;

    update public.billing_payment_proofs
    set status = 'approved',
        reviewed_by = v_actor,
        reviewed_at = now(),
        review_note = coalesce(review_note, 'Approved')
    where id = v_proof.id;

    update public.billing_subscriptions
    set status = 'active',
        activated_at = now(),
        expires_at = now() + make_interval(days => v_days),
        updated_at = now()
    where id = v_proof.subscription_id
    returning * into v_subscription;

    update public.billing_payment_proofs
    set status = 'rejected',
        reviewed_by = v_actor,
        reviewed_at = now(),
        review_note = coalesce(review_note, 'Superseded by approved proof')
    where subscription_id = v_proof.subscription_id
      and id <> v_proof.id
      and status = 'submitted';

    return v_subscription;
end;
$$;

create or replace function public.reject_payment_proof(
    p_proof_id uuid,
    p_reason text default null
)
returns public.billing_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
    v_actor uuid := auth.uid();
    v_proof public.billing_payment_proofs%rowtype;
    v_subscription public.billing_subscriptions%rowtype;
begin
    if not public.is_admin() then
        raise exception 'Admin access required.';
    end if;

    select *
    into v_proof
    from public.billing_payment_proofs
    where id = p_proof_id
    limit 1
    for update;

    if not found then
        raise exception 'Payment proof not found.';
    end if;

    if v_proof.status <> 'submitted' then
        raise exception 'Only submitted proofs can be rejected.';
    end if;

    update public.billing_payment_proofs
    set status = 'rejected',
        reviewed_by = v_actor,
        reviewed_at = now(),
        review_note = coalesce(nullif(trim(coalesce(p_reason, '')), ''), 'Payment proof rejected')
    where id = v_proof.id;

    update public.billing_subscriptions
    set status = 'rejected',
        updated_at = now()
    where id = v_proof.subscription_id
    returning * into v_subscription;

    return v_subscription;
end;
$$;

revoke all on function public.select_billing_plan(text) from public;
revoke all on function public.submit_payment_proof(text, text, text) from public;
revoke all on function public.approve_payment_proof(uuid, integer) from public;
revoke all on function public.reject_payment_proof(uuid, text) from public;

grant execute on function public.select_billing_plan(text) to authenticated;
grant execute on function public.submit_payment_proof(text, text, text) to authenticated;
grant execute on function public.approve_payment_proof(uuid, integer) to authenticated;
grant execute on function public.reject_payment_proof(uuid, text) to authenticated;

alter table public.billing_plans enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_payment_proofs enable row level security;

drop policy if exists "billing_plans_read" on public.billing_plans;
create policy "billing_plans_read"
on public.billing_plans
for select
using (is_active = true or public.is_admin());

drop policy if exists "billing_subscriptions_read_own_or_admin" on public.billing_subscriptions;
create policy "billing_subscriptions_read_own_or_admin"
on public.billing_subscriptions
for select
using (auth.uid() = user_id or public.is_admin());

drop policy if exists "billing_payment_proofs_read_own_or_admin" on public.billing_payment_proofs;
create policy "billing_payment_proofs_read_own_or_admin"
on public.billing_payment_proofs
for select
using (auth.uid() = user_id or public.is_admin());

insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do update set public = false;

drop policy if exists "payment_proofs_storage_select_owner_or_admin" on storage.objects;
create policy "payment_proofs_storage_select_owner_or_admin"
on storage.objects
for select to authenticated
using (
    bucket_id = 'payment-proofs'
    and (
        split_part(name, '/', 1) = auth.uid()::text
        or public.is_admin()
    )
);

drop policy if exists "payment_proofs_storage_insert_owner_or_admin" on storage.objects;
create policy "payment_proofs_storage_insert_owner_or_admin"
on storage.objects
for insert to authenticated
with check (
    bucket_id = 'payment-proofs'
    and (
        split_part(name, '/', 1) = auth.uid()::text
        or public.is_admin()
    )
);

drop policy if exists "payment_proofs_storage_update_owner_or_admin" on storage.objects;
create policy "payment_proofs_storage_update_owner_or_admin"
on storage.objects
for update to authenticated
using (
    bucket_id = 'payment-proofs'
    and (
        split_part(name, '/', 1) = auth.uid()::text
        or public.is_admin()
    )
)
with check (
    bucket_id = 'payment-proofs'
    and (
        split_part(name, '/', 1) = auth.uid()::text
        or public.is_admin()
    )
);

drop policy if exists "payment_proofs_storage_delete_owner_or_admin" on storage.objects;
create policy "payment_proofs_storage_delete_owner_or_admin"
on storage.objects
for delete to authenticated
using (
    bucket_id = 'payment-proofs'
    and (
        split_part(name, '/', 1) = auth.uid()::text
        or public.is_admin()
    )
);

commit;
