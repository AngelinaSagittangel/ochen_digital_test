import Canvas from './components/Canvas/Canvas';
import LibraryPanel from './components/LibraryPanel/LibraryPanel';
import Toolbar from './components/Toolbar/Toolbar';
import AutoBuild from "./components/AutoBuild/AutoBuild.tsx";

export default function App() {
    return (
        <div className="app">
            <aside className="panel"><AutoBuild/> <LibraryPanel/></aside>
            <main className="stage"><Canvas/></main>
            <aside className="panel"><Toolbar/></aside>
        </div>
    );
}