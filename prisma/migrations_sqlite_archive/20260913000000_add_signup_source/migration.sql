-- Signup provenance: where an account came from (UTM cookie + country header)
ALTER TABLE "User" ADD COLUMN "signupCountry" TEXT;
ALTER TABLE "User" ADD COLUMN "signupSource" TEXT;
ALTER TABLE "User" ADD COLUMN "signupReferrer" TEXT;
ALTER TABLE "User" ADD COLUMN "signupUtmSource" TEXT;
ALTER TABLE "User" ADD COLUMN "signupUtmMedium" TEXT;
ALTER TABLE "User" ADD COLUMN "signupUtmCampaign" TEXT;