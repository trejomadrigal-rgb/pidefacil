import { argv, exit } from 'process';

const API_URL = (process.env.API_URL ?? 'http://h81lvlzrwjd7jf8bp0tkg1wa.2.24.201.108.sslip.io').replace(/\/$/, '');
const WEB_URL = (process.env.WEB_URL ?? 'http://b10i6rz52rphphtcnxll73np.2.24.201.108.sslip.io').replace(/\/$/, '');
const ADMIN_URL = (process.env.ADMIN_URL ?? 'http://vh3jq4ik26i989m3xmlkrz20.2.24.201.108.sslip.io').replace(/\/$/, '');

function getArg(name: string): string {
  const idx = argv.indexOf(`--${name}`);
  if (idx === -1 || !argv[idx + 1]) throw new Error(`Missing required argument: --${name}`);
  return argv[idx + 1];
}

function getArgOptional(name: string): string | undefined {
  const idx = argv.indexOf(`--${name}`);
  return idx !== -1 && argv[idx + 1] ? argv[idx + 1] : undefined;
}

async function main() {
  const name      = getArg('name');
  const slug      = getArg('slug');
  const phone     = getArg('phone');
  const email     = getArg('email');
  const password  = getArg('password');
  const ownerName = getArgOptional('owner-name') ?? name;

  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ businessName: name, slug, phone, ownerName, email, password }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({} as Record<string, unknown>));
    const msg = (body as { message?: string }).message ?? res.statusText;
    console.error(`\n❌ Error (${res.status}): ${msg}\n`);
    exit(1);
  }

  console.log('\n✅ Fonda creada exitosamente\n');
  console.log(`  Negocio:    ${name}`);
  console.log(`  Admin URL:  ${ADMIN_URL}`);
  console.log(`  QR URL:     ${WEB_URL}/${slug}`);
  console.log(`  Email:      ${email}`);
  console.log(`  Contraseña: ${password}\n`);
  console.log('  El operador entra al Admin URL con las credenciales de arriba.');
  console.log(`  Comparte el QR URL con tus clientes: ${WEB_URL}/${slug}\n`);
}

main().catch((e: Error) => {
  console.error('\n❌ Error:', e.message, '\n');
  exit(1);
});
