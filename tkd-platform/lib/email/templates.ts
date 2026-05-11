export const athleteApprovedEmail = (athleteName: string, clubName: string) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#07070f;color:#ffffff;padding:40px 20px;margin:0">
  <div style="max-width:500px;margin:0 auto;background:#0d0d1a;border:1px solid #1e1e2e;border-radius:16px;padding:32px">
    <h1 style="color:#3b82f6;font-size:24px;margin:0 0 8px">TKD Platform</h1>
    <p style="color:#6b7280;margin:0 0 24px">Sistema de gestión de torneos</p>
    <div style="background:#0d1a0d;border:1px solid #166534;border-radius:12px;padding:20px;margin-bottom:24px">
      <p style="color:#4ade80;font-size:18px;font-weight:bold;margin:0 0 8px">¡Felicitaciones! 🎉</p>
      <p style="color:#d1fae5;margin:0">Tu registro en <strong>${clubName}</strong> ha sido <strong>aprobado</strong>.</p>
    </div>
    <p style="color:#9ca3af">Hola <strong style="color:#fff">${athleteName}</strong>,</p>
    <p style="color:#9ca3af">El entrenador de <strong style="color:#fff">${clubName}</strong> ha revisado tu solicitud y ha aprobado tu registro. Ya eres parte oficial del club.</p>
    <p style="color:#9ca3af">Pronto recibirás información sobre torneos y competencias disponibles.</p>
    <div style="border-top:1px solid #1e1e2e;margin-top:24px;padding-top:16px">
      <p style="color:#4b5563;font-size:12px;margin:0">TKD Platform — Sistema de gestión de torneos de Taekwondo</p>
    </div>
  </div>
</body>
</html>
`

export const athleteRejectedEmail = (athleteName: string, clubName: string) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#07070f;color:#ffffff;padding:40px 20px;margin:0">
  <div style="max-width:500px;margin:0 auto;background:#0d0d1a;border:1px solid #1e1e2e;border-radius:16px;padding:32px">
    <h1 style="color:#3b82f6;font-size:24px;margin:0 0 8px">TKD Platform</h1>
    <p style="color:#6b7280;margin:0 0 24px">Sistema de gestión de torneos</p>
    <div style="background:#1a0d0d;border:1px solid #991b1b;border-radius:12px;padding:20px;margin-bottom:24px">
      <p style="color:#f87171;font-size:18px;font-weight:bold;margin:0 0 8px">Registro no aprobado</p>
      <p style="color:#fecaca;margin:0">Tu solicitud en <strong>${clubName}</strong> no fue aprobada en esta ocasión.</p>
    </div>
    <p style="color:#9ca3af">Hola <strong style="color:#fff">${athleteName}</strong>,</p>
    <p style="color:#9ca3af">El entrenador de <strong style="color:#fff">${clubName}</strong> ha revisado tu solicitud pero no ha podido aprobarla en este momento.</p>
    <p style="color:#9ca3af">Si crees que es un error, contacta directamente al entrenador del club.</p>
    <div style="border-top:1px solid #1e1e2e;margin-top:24px;padding-top:16px">
      <p style="color:#4b5563;font-size:12px;margin:0">TKD Platform — Sistema de gestión de torneos de Taekwondo</p>
    </div>
  </div>
</body>
</html>
`

export const athleteRegisteredEmail = (athleteName: string, clubName: string, coachName: string) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#07070f;color:#ffffff;padding:40px 20px;margin:0">
  <div style="max-width:500px;margin:0 auto;background:#0d0d1a;border:1px solid #1e1e2e;border-radius:16px;padding:32px">
    <h1 style="color:#3b82f6;font-size:24px;margin:0 0 8px">TKD Platform</h1>
    <p style="color:#6b7280;margin:0 0 24px">Sistema de gestión de torneos</p>
    <div style="background:#0d1020;border:1px solid #1e3a5f;border-radius:12px;padding:20px;margin-bottom:24px">
      <p style="color:#60a5fa;font-size:18px;font-weight:bold;margin:0 0 8px">Solicitud recibida ✓</p>
      <p style="color:#bfdbfe;margin:0">Tu registro en <strong>${clubName}</strong> está siendo revisado.</p>
    </div>
    <p style="color:#9ca3af">Hola <strong style="color:#fff">${athleteName}</strong>,</p>
    <p style="color:#9ca3af">Hemos recibido tu solicitud de registro en <strong style="color:#fff">${clubName}</strong>.</p>
    <p style="color:#9ca3af">El entrenador <strong style="color:#fff">${coachName}</strong> revisará tu información y te notificaremos cuando seas aprobado.</p>
    <div style="border-top:1px solid #1e1e2e;margin-top:24px;padding-top:16px">
      <p style="color:#4b5563;font-size:12px;margin:0">TKD Platform — Sistema de gestión de torneos de Taekwondo</p>
    </div>
  </div>
</body>
</html>
`
export const clubRemovedFromFogueoEmail = (coachName: string, clubName: string, fogueoName: string) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#07070f;color:#ffffff;padding:40px 20px;margin:0">
  <div style="max-width:500px;margin:0 auto;background:#0d0d1a;border:1px solid #1e1e2e;border-radius:16px;padding:32px">
    <h1 style="color:#3b82f6;font-size:24px;margin:0 0 8px">TKD Platform</h1>
    <p style="color:#6b7280;margin:0 0 24px">Sistema de gestión de torneos</p>
    <div style="background:#1a0d0d;border:1px solid #991b1b;border-radius:12px;padding:20px;margin-bottom:24px">
      <p style="color:#f87171;font-size:18px;font-weight:bold;margin:0 0 8px">Retiro del fogueo</p>
      <p style="color:#fecaca;margin:0">El club <strong>${clubName}</strong> fue retirado del fogueo <strong>${fogueoName}</strong>.</p>
    </div>
    <p style="color:#9ca3af">Hola <strong style="color:#fff">${coachName}</strong>,</p>
    <p style="color:#9ca3af">Tu club y sus atletas han sido retirados del fogueo <strong style="color:#fff">${fogueoName}</strong>. Si crees que es un error contacta al organizador del evento.</p>
    <div style="border-top:1px solid #1e1e2e;margin-top:24px;padding-top:16px">
      <p style="color:#4b5563;font-size:12px;margin:0">TKD Platform — Sistema de gestión de torneos de Taekwondo</p>
    </div>
  </div>
</body>
</html>
`

export const clubInvitedToFogueoEmail = (coachName: string, clubName: string, fogueoName: string, fogueoDate: string, location: string) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#07070f;color:#ffffff;padding:40px 20px;margin:0">
  <div style="max-width:500px;margin:0 auto;background:#0d0d1a;border:1px solid #1e1e2e;border-radius:16px;padding:32px">
    <h1 style="color:#3b82f6;font-size:24px;margin:0 0 8px">TKD Platform</h1>
    <p style="color:#6b7280;margin:0 0 24px">Sistema de gestión de torneos</p>
    <div style="background:#0d1020;border:1px solid #1e3a5f;border-radius:12px;padding:20px;margin-bottom:24px">
      <p style="color:#60a5fa;font-size:18px;font-weight:bold;margin:0 0 8px">¡Invitación a fogueo! 🥋</p>
      <p style="color:#bfdbfe;margin:0">Has sido invitado al fogueo <strong>${fogueoName}</strong>.</p>
    </div>
    <p style="color:#9ca3af">Hola <strong style="color:#fff">${coachName}</strong>,</p>
    <p style="color:#9ca3af">El club <strong style="color:#fff">${clubName}</strong> ha sido invitado a participar en el fogueo <strong style="color:#fff">${fogueoName}</strong>.</p>
    <p style="color:#9ca3af">Fecha: <strong style="color:#fff">${fogueoDate}</strong></p>
    <p style="color:#9ca3af">Lugar: <strong style="color:#fff">${location}</strong></p>
    <p style="color:#9ca3af">Ingresa a TKD Platform para confirmar tu participación y registrar tus atletas.</p>
    <div style="border-top:1px solid #1e1e2e;margin-top:24px;padding-top:16px">
      <p style="color:#4b5563;font-size:12px;margin:0">TKD Platform — Sistema de gestión de torneos de Taekwondo</p>
    </div>
  </div>
</body>
</html>
`