function Signup() {
return (
    <div className="bg-[#cee4d8] min-h-screen flex justify-center items-center">

    <form className='bg-white space-y-3 w-[350px] h-[400px] flex justify-center items-center flex-col rounded-lg shadow-lg'>
        <div className='text-2xl font-bold text-top'> 
            <p>Sign Up</p>
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
        <div>
            <input className='w-[280px] h-10 rounded-lg px-5 outline-[#0b7d7b] border border-[#13A8A5]' type="password" placeholder='Confirm your Password' />
        </div>
        <div className='flex flex-col items-center'>
            <button className="bg-[#13A8A5] hover:bg-[#0a6c6a] text-white font-bold py-2 px-12 rounded-lg align-middle">Sign Up</button>
        </div>   
    </form>
    
    </div>
  );
}

export default Signup;