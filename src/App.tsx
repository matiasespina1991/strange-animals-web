import {HomePage} from '@/features/home/HomePage';
import {CustomCursor} from '@/features/home/components/CustomCursor';
import {ReleaseIdVerifierPage} from '@/features/release-id-verifier/ReleaseIdVerifierPage';
import {WebampSkinUploaderPage} from '@/features/webamp-skins/WebampSkinUploaderPage';
import {usePathRoute} from '@/hooks/usePathRoute';

export function App() {
  const route = usePathRoute();
  let page = <HomePage />;

  if (route === '/services/release-id-verifier') {
    page = <ReleaseIdVerifierPage />;
  }

  if (route === '/webamp-skin-uploader') {
    page = <WebampSkinUploaderPage />;
  }

  return (
    <>
      <CustomCursor />
      {page}
    </>
  );
}
