-- ─────────────────────────────────────────────────────────────────────────────
-- FieldLab AMS — Supabase Schema
-- Paste in: Supabase Dashboard → SQL Editor → New Query → Run
-- ─────────────────────────────────────────────────────────────────────────────


-- ══════════════════════════════════════════════════════════════════════════════
-- 1. TABLES
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.teams (
  id         uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id   uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text         NOT NULL,
  sport      text         NOT NULL DEFAULT 'football',
  category   text         NOT NULL DEFAULT 'senior',
  sex        text         NOT NULL DEFAULT 'male',
  color      text         NOT NULL DEFAULT '#3b82f6',
  created_at timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.players (
  id         uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    uuid         NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name       text         NOT NULL,
  position   text,
  birth_date date,
  sport      text,
  category   text,
  sex        text,
  tag        text,
  created_at timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wellness (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id   uuid         NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  coach_id    uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date        date         NOT NULL,
  sleep       int          NOT NULL CHECK (sleep       BETWEEN 1 AND 7),
  stress      int          NOT NULL CHECK (stress      BETWEEN 1 AND 7),
  fatigue     int          NOT NULL CHECK (fatigue     BETWEEN 1 AND 7),
  muscle_pain int          NOT NULL CHECK (muscle_pain BETWEEN 1 AND 7),
  composite   int          GENERATED ALWAYS AS (sleep + stress + fatigue + muscle_pain) STORED,
  zones       text,
  created_at  timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (player_id, date)
);

CREATE TABLE IF NOT EXISTS public.evaluations (
  id         uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id  uuid         NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  coach_id   uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date       date         NOT NULL,
  type       text         NOT NULL CHECK (type IN (
               'sj', 'cmj', 'dj', 'sprint', 'yoyo_ir1', 'yoyo_ir2',
               'navette', 'unca', 'cooper', 'cod'
             )),
  data       jsonb        NOT NULL DEFAULT '{}',
  created_at timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.loads (
  id         uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id  uuid          NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  coach_id   uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date       date          NOT NULL,
  value      numeric(7,1)  NOT NULL,
  notes      text,
  created_at timestamptz   NOT NULL DEFAULT now()
);


-- ══════════════════════════════════════════════════════════════════════════════
-- 2. INDEXES
-- ══════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_teams_coach       ON public.teams       (coach_id);
CREATE INDEX IF NOT EXISTS idx_players_team      ON public.players     (team_id);
CREATE INDEX IF NOT EXISTS idx_wellness_player   ON public.wellness    (player_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_wellness_coach    ON public.wellness    (coach_id);
CREATE INDEX IF NOT EXISTS idx_evals_player      ON public.evaluations (player_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_evals_coach       ON public.evaluations (coach_id);
CREATE INDEX IF NOT EXISTS idx_loads_player      ON public.loads       (player_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_loads_coach       ON public.loads       (coach_id);


-- ══════════════════════════════════════════════════════════════════════════════
-- 3. ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.teams       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wellness    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loads       ENABLE ROW LEVEL SECURITY;

-- ── teams ────────────────────────────────────────────────────────────────────

CREATE POLICY "teams_select" ON public.teams
  FOR SELECT USING (auth.uid() = coach_id);

CREATE POLICY "teams_insert" ON public.teams
  FOR INSERT WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "teams_update" ON public.teams
  FOR UPDATE USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "teams_delete" ON public.teams
  FOR DELETE USING (auth.uid() = coach_id);

-- ── players (access through team ownership) ──────────────────────────────────

CREATE POLICY "players_select" ON public.players
  FOR SELECT USING (
    team_id IN (SELECT id FROM public.teams WHERE coach_id = auth.uid())
  );

CREATE POLICY "players_insert" ON public.players
  FOR INSERT WITH CHECK (
    team_id IN (SELECT id FROM public.teams WHERE coach_id = auth.uid())
  );

CREATE POLICY "players_update" ON public.players
  FOR UPDATE
  USING (team_id IN (SELECT id FROM public.teams WHERE coach_id = auth.uid()))
  WITH CHECK (team_id IN (SELECT id FROM public.teams WHERE coach_id = auth.uid()));

CREATE POLICY "players_delete" ON public.players
  FOR DELETE USING (
    team_id IN (SELECT id FROM public.teams WHERE coach_id = auth.uid())
  );

-- ── wellness ─────────────────────────────────────────────────────────────────

CREATE POLICY "wellness_select" ON public.wellness
  FOR SELECT USING (auth.uid() = coach_id);

CREATE POLICY "wellness_insert" ON public.wellness
  FOR INSERT WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "wellness_update" ON public.wellness
  FOR UPDATE USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "wellness_delete" ON public.wellness
  FOR DELETE USING (auth.uid() = coach_id);

-- ── evaluations ──────────────────────────────────────────────────────────────

CREATE POLICY "evaluations_select" ON public.evaluations
  FOR SELECT USING (auth.uid() = coach_id);

CREATE POLICY "evaluations_insert" ON public.evaluations
  FOR INSERT WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "evaluations_update" ON public.evaluations
  FOR UPDATE USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "evaluations_delete" ON public.evaluations
  FOR DELETE USING (auth.uid() = coach_id);

-- ── loads ─────────────────────────────────────────────────────────────────────

CREATE POLICY "loads_select" ON public.loads
  FOR SELECT USING (auth.uid() = coach_id);

CREATE POLICY "loads_insert" ON public.loads
  FOR INSERT WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "loads_update" ON public.loads
  FOR UPDATE USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "loads_delete" ON public.loads
  FOR DELETE USING (auth.uid() = coach_id);


-- ══════════════════════════════════════════════════════════════════════════════
-- 4. SEED DATA
-- ──────────────────────────────────────────────────────────────────────────────
-- BEFORE RUNNING: replace the v_coach UUID below with your actual user UUID.
-- Find it in: Supabase → Authentication → Users → click your email → copy UUID
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  -- ▼ REPLACE with your auth user UUID ▼
  v_coach uuid := '00000000-0000-0000-0000-000000000000';

  v_team uuid := 'aaaaaaaa-1111-0000-0000-000000000001';

  v_p1 uuid := 'bbbbbbbb-0001-0000-0000-000000000000';
  v_p2 uuid := 'bbbbbbbb-0002-0000-0000-000000000000';
  v_p3 uuid := 'bbbbbbbb-0003-0000-0000-000000000000';
  v_p4 uuid := 'bbbbbbbb-0004-0000-0000-000000000000';
  v_p5 uuid := 'bbbbbbbb-0005-0000-0000-000000000000';

  v_today date := current_date;
BEGIN

  -- ── Team ──────────────────────────────────────────────────────────────────
  INSERT INTO public.teams (id, coach_id, name, sport, category, sex, color)
  VALUES (v_team, v_coach, 'Primera División', 'football', 'senior', 'male', '#3b82f6')
  ON CONFLICT (id) DO NOTHING;

  -- ── Players ───────────────────────────────────────────────────────────────
  INSERT INTO public.players (id, team_id, name, position, birth_date, sport, category, sex)
  VALUES
    (v_p1, v_team, 'Ramiro Gómez',   'Delantero',  '2000-03-15', 'football', 'senior', 'male'),
    (v_p2, v_team, 'Leandro Pérez',  'Mediocampo', '1999-07-22', 'football', 'senior', 'male'),
    (v_p3, v_team, 'Tomás Herrera',  'Defensor',   '2001-11-08', 'football', 'senior', 'male'),
    (v_p4, v_team, 'Facundo Suárez', 'Arquero',    '1998-05-30', 'football', 'senior', 'male'),
    (v_p5, v_team, 'Agustín Molina', 'Delantero',  '2002-01-17', 'football', 'senior', 'male')
  ON CONFLICT (id) DO NOTHING;

  -- ── Wellness — 7 días por jugador ─────────────────────────────────────────
  -- Ramiro: carga moderada-alta, riesgo en día -2
  INSERT INTO public.wellness (player_id, coach_id, date, sleep, stress, fatigue, muscle_pain, zones)
  VALUES
    (v_p1, v_coach, v_today - 6, 3, 3, 3, 3, 'piernas'),
    (v_p1, v_coach, v_today - 5, 4, 2, 3, 2, NULL),
    (v_p1, v_coach, v_today - 4, 5, 3, 4, 3, 'espalda'),
    (v_p1, v_coach, v_today - 3, 3, 4, 4, 4, 'piernas'),
    (v_p1, v_coach, v_today - 2, 2, 5, 5, 5, 'piernas,rodilla'),
    (v_p1, v_coach, v_today - 1, 4, 3, 3, 3, NULL),
    (v_p1, v_coach, v_today,     3, 3, 4, 3, 'piernas')
  ON CONFLICT (player_id, date) DO NOTHING;

  -- Leandro: en forma, bienestar óptimo
  INSERT INTO public.wellness (player_id, coach_id, date, sleep, stress, fatigue, muscle_pain, zones)
  VALUES
    (v_p2, v_coach, v_today - 6, 2, 2, 2, 2, NULL),
    (v_p2, v_coach, v_today - 5, 3, 2, 2, 2, NULL),
    (v_p2, v_coach, v_today - 4, 3, 3, 3, 2, NULL),
    (v_p2, v_coach, v_today - 3, 4, 3, 3, 3, 'espalda'),
    (v_p2, v_coach, v_today - 2, 3, 2, 3, 3, NULL),
    (v_p2, v_coach, v_today - 1, 2, 2, 2, 2, NULL),
    (v_p2, v_coach, v_today,     3, 2, 2, 2, NULL)
  ON CONFLICT (player_id, date) DO NOTHING;

  -- Tomás: molestias en rodilla persistentes (Hooper alto)
  INSERT INTO public.wellness (player_id, coach_id, date, sleep, stress, fatigue, muscle_pain, zones)
  VALUES
    (v_p3, v_coach, v_today - 6, 5, 4, 5, 6, 'rodilla,tobillo'),
    (v_p3, v_coach, v_today - 5, 5, 5, 5, 6, 'rodilla'),
    (v_p3, v_coach, v_today - 4, 4, 4, 5, 5, 'rodilla'),
    (v_p3, v_coach, v_today - 3, 6, 5, 6, 6, 'rodilla,piernas'),
    (v_p3, v_coach, v_today - 2, 5, 4, 5, 5, 'rodilla'),
    (v_p3, v_coach, v_today - 1, 4, 4, 4, 5, NULL),
    (v_p3, v_coach, v_today,     5, 4, 5, 5, 'rodilla')
  ON CONFLICT (player_id, date) DO NOTHING;

  -- Facundo: arquero, descansado y estable
  INSERT INTO public.wellness (player_id, coach_id, date, sleep, stress, fatigue, muscle_pain, zones)
  VALUES
    (v_p4, v_coach, v_today - 6, 2, 2, 2, 1, NULL),
    (v_p4, v_coach, v_today - 5, 2, 2, 2, 2, NULL),
    (v_p4, v_coach, v_today - 4, 3, 2, 2, 2, NULL),
    (v_p4, v_coach, v_today - 3, 2, 3, 3, 2, NULL),
    (v_p4, v_coach, v_today - 2, 2, 2, 2, 2, NULL),
    (v_p4, v_coach, v_today - 1, 3, 2, 2, 2, NULL),
    (v_p4, v_coach, v_today,     2, 2, 3, 2, NULL)
  ON CONFLICT (player_id, date) DO NOTHING;

  -- Agustín: fatiga acumulada semana intensa
  INSERT INTO public.wellness (player_id, coach_id, date, sleep, stress, fatigue, muscle_pain, zones)
  VALUES
    (v_p5, v_coach, v_today - 6, 4, 3, 4, 3, 'espalda'),
    (v_p5, v_coach, v_today - 5, 3, 4, 4, 4, NULL),
    (v_p5, v_coach, v_today - 4, 5, 4, 5, 4, 'piernas'),
    (v_p5, v_coach, v_today - 3, 6, 5, 6, 5, 'piernas,espalda'),
    (v_p5, v_coach, v_today - 2, 5, 5, 5, 5, 'piernas'),
    (v_p5, v_coach, v_today - 1, 4, 4, 4, 4, NULL),
    (v_p5, v_coach, v_today,     4, 3, 4, 3, NULL)
  ON CONFLICT (player_id, date) DO NOTHING;

  -- ── Evaluaciones — 3 por jugador (CMJ, Sprint 30m, Yo-Yo IR1) ─────────────
  INSERT INTO public.evaluations (player_id, coach_id, date, type, data)
  VALUES
    -- Ramiro
    (v_p1, v_coach, v_today - 5, 'cmj',
      '{"height": 38.5, "jumpType": "CMJ", "leftHeight": 37.2, "rightHeight": 38.5, "lsi": 3.4}'::jsonb),
    (v_p1, v_coach, v_today - 4, 'sprint',
      '{"distance": 30, "time": 4.12, "velocity": 26.2}'::jsonb),
    (v_p1, v_coach, v_today - 3, 'yoyo_ir1',
      '{"distance": 1280, "level": "16/1", "vo2max": 48.3}'::jsonb),

    -- Leandro
    (v_p2, v_coach, v_today - 5, 'cmj',
      '{"height": 42.1, "jumpType": "CMJ", "leftHeight": 41.8, "rightHeight": 42.1, "lsi": 0.7}'::jsonb),
    (v_p2, v_coach, v_today - 4, 'sprint',
      '{"distance": 30, "time": 3.98, "velocity": 27.1}'::jsonb),
    (v_p2, v_coach, v_today - 3, 'yoyo_ir1',
      '{"distance": 1520, "level": "17/4", "vo2max": 51.2}'::jsonb),

    -- Tomás
    (v_p3, v_coach, v_today - 5, 'cmj',
      '{"height": 35.0, "jumpType": "CMJ", "leftHeight": 32.1, "rightHeight": 35.0, "lsi": 8.3}'::jsonb),
    (v_p3, v_coach, v_today - 4, 'sprint',
      '{"distance": 30, "time": 4.31, "velocity": 25.1}'::jsonb),
    (v_p3, v_coach, v_today - 3, 'yoyo_ir1',
      '{"distance": 960, "level": "14/4", "vo2max": 43.5}'::jsonb),

    -- Facundo
    (v_p4, v_coach, v_today - 5, 'cmj',
      '{"height": 40.8, "jumpType": "CMJ", "leftHeight": 40.5, "rightHeight": 40.8, "lsi": 0.7}'::jsonb),
    (v_p4, v_coach, v_today - 4, 'sprint',
      '{"distance": 30, "time": 4.05, "velocity": 26.7}'::jsonb),
    (v_p4, v_coach, v_today - 3, 'yoyo_ir1',
      '{"distance": 1760, "level": "19/1", "vo2max": 54.8}'::jsonb),

    -- Agustín
    (v_p5, v_coach, v_today - 5, 'cmj',
      '{"height": 36.2, "jumpType": "CMJ", "leftHeight": 34.0, "rightHeight": 36.2, "lsi": 6.1}'::jsonb),
    (v_p5, v_coach, v_today - 4, 'sprint',
      '{"distance": 30, "time": 4.22, "velocity": 25.6}'::jsonb),
    (v_p5, v_coach, v_today - 3, 'yoyo_ir1',
      '{"distance": 1120, "level": "15/4", "vo2max": 46.1}'::jsonb);

  -- ── Cargas — 7 días por jugador (UA = RPE × minutos) ─────────────────────
  INSERT INTO public.loads (player_id, coach_id, date, value, notes)
  VALUES
    -- Ramiro
    (v_p1, v_coach, v_today - 6, 480, 'Entreno táctico'),
    (v_p1, v_coach, v_today - 5, 560, 'Partido amistoso'),
    (v_p1, v_coach, v_today - 4, 320, 'Recuperación activa'),
    (v_p1, v_coach, v_today - 3, 600, 'Entreno físico intenso'),
    (v_p1, v_coach, v_today - 2, 680, 'Partido oficial'),
    (v_p1, v_coach, v_today - 1, 300, 'Regenerativo'),
    (v_p1, v_coach, v_today,     450, 'Entreno técnico'),
    -- Leandro
    (v_p2, v_coach, v_today - 6, 440, 'Entreno táctico'),
    (v_p2, v_coach, v_today - 5, 520, 'Partido amistoso'),
    (v_p2, v_coach, v_today - 4, 300, 'Descanso activo'),
    (v_p2, v_coach, v_today - 3, 580, 'Entreno físico'),
    (v_p2, v_coach, v_today - 2, 640, 'Partido oficial'),
    (v_p2, v_coach, v_today - 1, 280, 'Regenerativo'),
    (v_p2, v_coach, v_today,     420, 'Entreno técnico'),
    -- Tomás
    (v_p3, v_coach, v_today - 6, 360, 'Fisio + entreno suave'),
    (v_p3, v_coach, v_today - 5, 420, 'Partido amistoso parcial'),
    (v_p3, v_coach, v_today - 4, 200, 'Fisioterapia'),
    (v_p3, v_coach, v_today - 3, 380, 'Retorno gradual'),
    (v_p3, v_coach, v_today - 2, 460, 'Partido oficial parcial'),
    (v_p3, v_coach, v_today - 1, 180, 'Regenerativo'),
    (v_p3, v_coach, v_today,     320, 'Táctico suave'),
    -- Facundo
    (v_p4, v_coach, v_today - 6, 500, 'Entreno táctico'),
    (v_p4, v_coach, v_today - 5, 540, 'Partido amistoso'),
    (v_p4, v_coach, v_today - 4, 340, 'Recuperación'),
    (v_p4, v_coach, v_today - 3, 620, 'Entreno físico'),
    (v_p4, v_coach, v_today - 2, 700, 'Partido oficial'),
    (v_p4, v_coach, v_today - 1, 280, 'Regenerativo'),
    (v_p4, v_coach, v_today,     460, 'Entreno técnico'),
    -- Agustín
    (v_p5, v_coach, v_today - 6, 520, 'Entreno táctico'),
    (v_p5, v_coach, v_today - 5, 580, 'Partido amistoso'),
    (v_p5, v_coach, v_today - 4, 380, 'Recuperación'),
    (v_p5, v_coach, v_today - 3, 640, 'Entreno físico'),
    (v_p5, v_coach, v_today - 2, 720, 'Partido oficial'),
    (v_p5, v_coach, v_today - 1, 320, 'Regenerativo'),
    (v_p5, v_coach, v_today,     480, 'Entreno técnico');

END $$;
