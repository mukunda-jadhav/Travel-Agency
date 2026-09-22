create table if not exists travel_demo_bookings (
  booking_id text primary key, user_phone text not null, record jsonb not null,
  created_at timestamptz not null default now()
);
create table if not exists travel_message_results (
  event_id text primary key, user_phone text not null, reply text not null,
  created_at timestamptz not null default now()
);
alter table travel_demo_bookings enable row level security;
alter table travel_message_results enable row level security;

-- Commit the session, booking and deduplication response in one transaction.
create or replace function commit_travel_turn(p_user text,p_event text,p_state jsonb,p_reply text,p_booking jsonb)
returns void language plpgsql security invoker set search_path=public as $$
begin
  perform pg_advisory_xact_lock(hashtext(p_user));
  if exists(select 1 from travel_message_results where event_id=p_event) then return; end if;
  insert into conversations(user_phone,state) values(p_user,jsonb_build_object('travel',p_state))
  on conflict(user_phone) do update set state=conversations.state || excluded.state,updated_at=now();
  if p_booking is not null then
    insert into travel_demo_bookings(booking_id,user_phone,record) values(p_booking->>'bookingId',p_user,p_booking);
  end if;
  insert into travel_message_results(event_id,user_phone,reply) values(p_event,p_user,p_reply);
end $$;
revoke all on function commit_travel_turn(text,text,jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function commit_travel_turn(text,text,jsonb,text,jsonb) to service_role;
