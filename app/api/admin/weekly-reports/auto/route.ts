import { NextRequest } from "next/server";
import { requireSuperAdmin } from "@/app/lib/middleware";
import { apiSuccess, apiError } from "@/app/lib/response";
import { logger } from "@/app/lib/logger";
import { getAutoEnabled, setAutoEnabled } from "@/app/services/weekly-report.service";

/** GET → { enabled }.  POST { enabled: boolean } → switch the automatic weekly send on/off (super-admin). */
export async function GET(req: NextRequest) {
  const { error } = requireSuperAdmin(req);
  if (error) return error;
  return apiSuccess({ enabled: await getAutoEnabled() });
}

export async function POST(req: NextRequest) {
  try {
    const { error, user } = requireSuperAdmin(req);
    if (error) return error;
    const body = await req.json().catch(() => ({}));
    if (typeof body?.enabled !== "boolean") return apiError(400, "enabled must be true or false.");
    await setAutoEnabled(body.enabled);
    logger.info("weekly-report", "auto_switched", { by: user!.userId, enabled: body.enabled });
    return apiSuccess({ enabled: body.enabled });
  } catch {
    return apiError(500, "Could not change the setting.");
  }
}
