import {HomePage} from '@/features/home/HomePage';
import {ReleaseIdVerifierPage} from '@/features/release-id-verifier/ReleaseIdVerifierPage';
import {WebampSkinUploaderPage} from '@/features/webamp-skins/WebampSkinUploaderPage';
import {usePathRoute} from '@/hooks/usePathRoute';

export function App() {
  const route = usePathRoute();

  if (route === '/services/release-id-verifier') {
    return <ReleaseIdVerifierPage />;
  }

  if (route === '/webamp-skin-uploader') {
    return <WebampSkinUploaderPage />;
  }

  return <HomePage />;
}
