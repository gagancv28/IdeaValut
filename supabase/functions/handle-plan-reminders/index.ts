import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const APP_BASE_URL = Deno.env.get("APP_BASE_URL") || "https://ideavault.com";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface Startup {
  id: number;
  "company name"?: string;
  company_name?: string;
  founder_name?: string;
  email?: string;
  contact_email?: string;
  expiry_date?: string;
  expires_at?: string;
  status?: string;
  tier?: string;
  plan_type?: string;
  user_id?: string;
}

serve(async (req: Request) => {
  try {
    console.log("[handle-plan-reminders] Edge Function triggered");

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Target expiration dates: 7 days and 14 days away from today
    const target7Days = new Date(today);
    target7Days.setDate(target7Days.getDate() + 7);

    const target14Days = new Date(today);
    target14Days.setDate(target14Days.getDate() + 14);

    // Fetch active startups from database
    const { data: startups, error } = await supabase
      .from("startups")
      .select("*");

    if (error) {
      console.error("[handle-plan-reminders] Error fetching startups:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const remindersSent: Array<{ startupId: number; email: string; daysRemaining: number }> = [];

    for (const startup of (startups as Startup[] || [])) {
      const rawExpiry = startup.expiry_date || startup.expires_at;
      if (!rawExpiry) continue;

      const expiryDate = new Date(rawExpiry);
      expiryDate.setHours(0, 0, 0, 0);

      const diffTime = expiryDate.getTime() - today.getTime();
      const daysRemaining = Math.round(diffTime / (1000 * 60 * 60 * 24));

      // Match exactly 7 days or 14 days away
      if (daysRemaining === 7 || daysRemaining === 14) {
        const recipientEmail = startup.contact_email || startup.email;
        const companyName = startup["company name"] || startup.company_name || "Your Startup";
        const founderName = startup.founder_name || "Founder";

        if (!recipientEmail) {
          console.warn(`[handle-plan-reminders] No recipient email found for startup ID ${startup.id}`);
          continue;
        }

        const upgradeUrl = `${APP_BASE_URL}/dashboard/upgrade`;

        console.log(
          `[handle-plan-reminders] Sending ${daysRemaining}-day reminder to ${recipientEmail} for startup '${companyName}'`
        );

        // Trigger automated notification email via Resend API (or configured SMTP / HTTP endpoint)
        if (RESEND_API_KEY) {
          const resendRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: "IdeaVault Support <notifications@ideavault.com>",
              to: [recipientEmail],
              subject: `Action Required: Your ${companyName} Plan Expires in ${daysRemaining} Days`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
                  <div style="background-color: #4f46e5; padding: 16px 24px; border-radius: 6px 6px 0 0; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 20px;">IdeaVault Renewal Notice</h1>
                  </div>
                  <div style="padding: 24px;">
                    <p style="font-size: 16px; color: #1e293b;">Hello <strong>${founderName}</strong>,</p>
                    <p style="font-size: 15px; color: #334155; line-height: 1.6;">
                      This is an automated reminder that your plan for <strong>${companyName}</strong> is expiring in <strong>${daysRemaining} days</strong> on <strong>${expiryDate.toLocaleDateString()}</strong>.
                    </p>
                    <p style="font-size: 15px; color: #334155; line-height: 1.6;">
                      Renew today to maintain your featured placement in the directory and keep investor inquiries flowing.
                    </p>
                    <div style="margin: 32px 0; text-align: center;">
                      <a href="${upgradeUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block;">
                        Renew Plan on /dashboard/upgrade
                      </a>
                    </div>
                    <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
                      Direct Link: <a href="${upgradeUrl}" style="color: #4f46e5;">${upgradeUrl}</a>
                    </p>
                  </div>
                  <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center; color: #94a3b8; font-size: 12px;">
                    IdeaVault Directory &bull; Zero-Brokerage Startup Network
                  </div>
                </div>
              `,
            }),
          });

          if (!resendRes.ok) {
            const errBody = await resendRes.text();
            console.error(`[handle-plan-reminders] Resend API error for ${recipientEmail}:`, errBody);
          } else {
            console.log(`[handle-plan-reminders] Notification email successfully sent to ${recipientEmail}`);
          }
        } else {
          console.log(
            `[handle-plan-reminders] RESEND_API_KEY not configured. Simulated notification sent to ${recipientEmail} (${daysRemaining} days remaining).`
          );
        }

        remindersSent.push({
          startupId: startup.id,
          email: recipientEmail,
          daysRemaining,
        });
      }
    }

    return new Response(
      JSON.stringify({
        message: `Plan expiration check completed successfully.`,
        notificationsSent: remindersSent.length,
        remindersSent,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[handle-plan-reminders] Exception:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
