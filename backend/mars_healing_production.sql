CREATE TABLE IF NOT EXISTS mars_healing_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_tier SMALLINT NOT NULL CHECK (plan_tier IN (1, 2, 3)),
    plan_label TEXT NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
    representative_name VARCHAR(100) NOT NULL,
    age SMALLINT NOT NULL CHECK (age BETWEEN 1 AND 150),
    phone VARCHAR(30) NOT NULL,
    occupation VARCHAR(150) NOT NULL,
    address TEXT NOT NULL,
    agent_name VARCHAR(100),
    photo_path TEXT NOT NULL,
    reference_note TEXT,
    transfer_last_five CHAR(5) NOT NULL CHECK (transfer_last_five ~ '^[0-9]{5}$'),
    transfer_memo TEXT,
    payment_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'verified', 'rejected')),
    registration_status VARCHAR(20) NOT NULL DEFAULT 'submitted' CHECK (registration_status IN ('submitted', 'reviewing', 'approved', 'rejected')),
    admin_note TEXT,
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mars_healing_registrations_user_id ON mars_healing_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_mars_healing_registrations_created_at ON mars_healing_registrations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mars_healing_registrations_review_status ON mars_healing_registrations(registration_status, payment_status);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('mars-healing-photos', 'mars-healing-photos', false, 5242880, ARRAY['image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png'];

ALTER TABLE mars_healing_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Mars users can create registrations" ON mars_healing_registrations;
CREATE POLICY "Mars users can create registrations"
ON mars_healing_registrations FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Mars users can view own registrations" ON mars_healing_registrations;
CREATE POLICY "Mars users can view own registrations"
ON mars_healing_registrations FOR SELECT
USING (auth.uid() = user_id);


DROP POLICY IF EXISTS "Mars users can cancel pending registrations" ON mars_healing_registrations;
CREATE POLICY "Mars users can cancel pending registrations"
ON mars_healing_registrations FOR UPDATE
USING (
    auth.uid() = user_id
    AND payment_status = 'pending'
    AND registration_status IN ('submitted', 'reviewing')
)
WITH CHECK (
    auth.uid() = user_id
    AND (
        (
            payment_status = 'pending'
            AND registration_status IN ('submitted', 'reviewing')
        )
        OR (
            payment_status = 'rejected'
            AND registration_status = 'rejected'
        )
    )
);
DROP POLICY IF EXISTS "Mars admins can manage registrations" ON mars_healing_registrations;
CREATE POLICY "Mars admins can manage registrations"
ON mars_healing_registrations FOR ALL
USING ((auth.jwt() ->> 'email') = '2022lingyun@gmail.com')
WITH CHECK ((auth.jwt() ->> 'email') = '2022lingyun@gmail.com');

DROP POLICY IF EXISTS "Mars users can upload own photos" ON storage.objects;
CREATE POLICY "Mars users can upload own photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'mars-healing-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Mars users can view own photos" ON storage.objects;
CREATE POLICY "Mars users can view own photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'mars-healing-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Mars admins can view photos" ON storage.objects;
CREATE POLICY "Mars admins can view photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'mars-healing-photos'
    AND (auth.jwt() ->> 'email') = '2022lingyun@gmail.com'
);

DROP POLICY IF EXISTS "Mars users can delete own photos" ON storage.objects;
CREATE POLICY "Mars users can delete own photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'mars-healing-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
);
