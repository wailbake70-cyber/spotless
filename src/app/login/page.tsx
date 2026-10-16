import { redirect } from 'next/navigation';

// No auth needed — redirect to dashboard
export default function LoginPage() {
  redirect('/');
}
