import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Login from './Components/login';
import Signin from './Components/signin';
import Signup from './Components/singup';

function App() {
return (
    <Router>
        <div className="App">
            <nav className='bg-[#0b7d7b] py-2'>
                <div className='flex items-center justify-between'>
                    <div className='w-1/3'></div>
                    
                    <div className='w-1/3 flex justify-center'> 
                        <img className='object-contain h-10' src="logo/logo.png" alt="logo" />
                    </div>
                
                    <div className="w-1/3 flex justify-end space-x-4">
                        <Link to="/" className="px-2 py-1 border-2 border-white text-white font-semibold rounded-lg hover:bg-[#0b7d7b] hover:text-white transition">
                            LOGIN
                        </Link>

                        <Link to="/signin" className="px-2 py-1 border-2 border-white text-white font-semibold rounded-lg hover:bg-[#0b7d7b] hover:text-white transition">
                            SIGN IN
                        </Link>
                    </div>
                
                </div>
            </nav>

            <Routes>
                <Route path="/" element={<Login />} />
                <Route path="/signin" element={<Signin />} />
                <Route path="/signup" element={<Signup />} />
            </Routes>    
        </div>
    </Router>
  );    
}
export default App;