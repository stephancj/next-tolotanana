type VolunteerConfirmation = {
  email: string;
  firstName: string;
  lastName: string;
  editionName: string;
  editionPlace: string;
  editionYear: number;
  registrationId: string;
};

type BrevoResponse = { messageId?: string; message?: string; code?: string };

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
}[character] || character));

export async function sendVolunteerConfirmation(data: VolunteerConfirmation) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  if (!apiKey || !senderEmail) return { sent: false, skipped: true as const };

  const senderName = process.env.BREVO_SENDER_NAME || 'Tolo-Tagnana';
  const replyToEmail = process.env.BREVO_REPLY_TO_EMAIL || senderEmail;
  const templateId = Number(process.env.BREVO_VOLUNTEER_TEMPLATE_ID || 0);
  const tolotagnanaLogoUrl = process.env.BREVO_TOLOTAGNANA_LOGO_URL || 'https://tolotanana.rotary.mg/assets/img/logo-tolotagnana.png';
  const rotaractLogoUrl = process.env.BREVO_ROTARACT_LOGO_URL || 'https://rotaplast.rotary.mg/assets/rotaract-madagasikara-logo.png';
  const fullName = `${data.firstName} ${data.lastName}`.trim();
  const editionName = data.editionName.trim();
  const normalizedEditionName = editionName.toLocaleLowerCase('fr');
  const editionDetails = [
    normalizedEditionName.includes(data.editionPlace.trim().toLocaleLowerCase('fr')) ? null : data.editionPlace,
    normalizedEditionName.includes(String(data.editionYear)) ? null : String(data.editionYear),
  ].filter(Boolean);
  const mission = [editionName, ...editionDetails].join(' · ');
  const params = {
    firstName: data.firstName,
    lastName: data.lastName,
    fullName,
    editionName: data.editionName,
    editionPlace: data.editionPlace,
    editionYear: data.editionYear,
    registrationId: data.registrationId,
  };

  const content = templateId > 0 ? { templateId, params } : {
    subject: `Candidature volontaire reçue · ${data.editionName}`,
    htmlContent: `<!doctype html><html lang="fr"><body style="margin:0;background:#f4f6f8;color:#54565a;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f8"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#fdfcfe;border-top:6px solid #d41367"><tr><td style="padding:28px 38px 22px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td valign="middle"><img src="${escapeHtml(tolotagnanaLogoUrl)}" width="270" alt="Tolo-Tagnana" style="display:block;width:100%;max-width:270px;height:auto;border:0"></td><td width="118" valign="middle" align="right" style="padding-left:22px"><img src="${escapeHtml(rotaractLogoUrl)}" width="112" alt="Rotaract" style="display:block;width:112px;max-width:100%;height:auto;border:0"></td></tr></table><p style="margin:24px 0 0;color:#d41367;font-size:12px;font-weight:700;letter-spacing:1.5px">TOLO-TAGNANA · ROTARACT MADAGASCAR</p><h1 style="margin:14px 0 0;color:#17458f;font-size:30px;line-height:1.15">Candidature bien reçue</h1></td></tr><tr><td style="padding:0 38px 34px"><p style="font-size:16px;line-height:1.6">Bonjour ${escapeHtml(data.firstName)},</p><p style="font-size:16px;line-height:1.6">Merci d’avoir proposé votre aide pour Tolo-Tagnana. Votre candidature de volontaire a bien été enregistrée pour :</p><div style="margin:24px 0;padding:20px;background:#e9f4fb;border-top:4px solid #0067c8"><strong style="display:block;color:#17458f;font-size:18px">${escapeHtml(mission)}</strong></div><p style="font-size:16px;line-height:1.6"><strong>Cette confirmation ne vaut pas encore acceptation.</strong> L’équipe étudiera les besoins de la mission, puis vous contactera pour la suite.</p><p style="margin-top:28px;font-size:16px;line-height:1.6">Misaotra,<br><strong style="color:#17458f">L’équipe Tolo-Tagnana</strong></p></td></tr><tr><td style="padding:18px 38px;background:#17458f;color:#dbe8f3;font-size:12px;line-height:1.5">Vous recevez ce message après votre candidature volontaire sur le site Rotaract Madagascar.</td></tr></table></td></tr></table></body></html>`,
  };

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { accept: 'application/json', 'api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: data.email, name: fullName }],
      replyTo: { email: replyToEmail, name: senderName },
      tags: ['volunteer-registration', `edition-${data.editionYear}`],
      ...content,
    }),
  });

  const body = await response.json().catch(() => ({})) as BrevoResponse;
  if (!response.ok) throw new Error(`Brevo ${response.status}: ${body.message || body.code || 'email rejected'}`);
  return { sent: true, skipped: false as const, messageId: body.messageId || null };
}
