-- ─────────────────────────────────────────────────────────────────────────────
-- FieldLab — Fix RLS crítico: players_select_anon / teams_select_anon
-- Paste in: Supabase Dashboard → SQL Editor → New Query → Run
--
-- Reemplaza el SELECT anónimo sin scope (USING true) sobre players/teams —
-- que exponía el roster completo de TODOS los coaches a cualquiera con la
-- anon key pública — por dos funciones SECURITY DEFINER que solo devuelven
-- exactamente lo que el flujo QR necesita (roster de un team_id puntual,
-- coach_id de un player_id puntual).
--
-- Seguro de correr sobre la base existente: no toca datos, solo policies y
-- funciones. Es el mismo cambio que ya quedó reflejado en supabase/schema.sql.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "players_select_anon" ON public.players;
DROP POLICY IF EXISTS "teams_select_anon"   ON public.teams;

CREATE OR REPLACE FUNCTION public.qr_team_roster(p_team_id uuid)
RETURNS TABLE (id uuid, name text, position text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT p.id, p.name, p.position
  FROM public.players p
  WHERE p.team_id = p_team_id
  ORDER BY p.name;
$$;

REVOKE ALL ON FUNCTION public.qr_team_roster(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.qr_team_roster(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.qr_resolve_coach(p_player_id uuid)
RETURNS TABLE (player_id uuid, team_id uuid, coach_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT p.id, p.team_id, t.coach_id
  FROM public.players p
  JOIN public.teams t ON t.id = p.team_id
  WHERE p.id = p_player_id;
$$;

REVOKE ALL ON FUNCTION public.qr_resolve_coach(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.qr_resolve_coach(uuid) TO anon, authenticated;
