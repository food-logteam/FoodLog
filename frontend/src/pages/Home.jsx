// NOTE: no diacritics in comments
import Header from '../components/Header.jsx';
import MainContent from '../components/MainContent.jsx';

export default function Home() {
  return (
    <div className="bg-page" style={{minHeight:'100vh', display:'flex', flexDirection:'column'}}>
      <Header />
      <MainContent />
    </div>
  );
}
