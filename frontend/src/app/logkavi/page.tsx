import { redirect } from 'next/navigation';

// Secret admin entry point — redirects to the actual login page
// Accessible at vfinserve.in/logkavi
export default function LogKavi() {
  redirect('/login');
}
