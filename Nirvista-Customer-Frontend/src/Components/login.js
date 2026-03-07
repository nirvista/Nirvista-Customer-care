import { Link } from "react-router-dom";

function Login() {
   return (
    <div className="bg-[#cee4d8] min-h-screen flex justify-center items-center">

    <form className='bg-white space-y-3 w-[350px] h-[400px] flex justify-center items-center flex-col rounded-lg shadow-lg'>
        <div className='text-2xl font-bold '> 
            <p>Login</p>
        </div>
        <div>
            <input className='w-[280px] h-10 rounded-lg px-5 outline-[#0b7d7b] border border-[#13A8A5]' type="text" placeholder='Enter your Name' />
        </div>
        <div>
            <input className='w-[280px] h-10 rounded-lg px-5 outline-[#0b7d7b] border border-[#13A8A5]' type="text" placeholder='Enter your Email ID' />
        </div>
        <div>
            <input className='w-[280px] h-10 rounded-lg px-5 outline-[#0b7d7b] border border-[#13A8A5]' type="password" placeholder='Enter your Password' />
        </div>
        <div className='w-[280px] text-right hover:underline text-sm'>
            <a href="!#" className='text-black-200 hover:text-[#0b7d7b]'>Forgot Password?</a>
        </div>
        <div className='flex flex-col items-center'>
            <button className="bg-[#13A8A5] hover:bg-[#0a6c6a] text-white font-bold py-2 px-12 rounded-lg align-middle">Login</button>
          <p className='text-sm text-center'>
          New User? <Link to="/signup" className='text-[#13A8A5] hover:text-[#0b7d7b] ml-1'>Sign Up</Link>
          </p>
        </div>   
    </form>
    
    </div>
  );
}

export default Login;