import { Redirect } from "react-router";
import React from "react";

const EditProfile = () => {
  const [move, setMove] = React.useState(false);
  if(move)
    return <Redirect to={'/edit_profile'}/>

  return(
    <input type="button" className="px-3 py-3 text-black rounded-md cursor-pointer" 
    style={{backgroundColor:'lightgray'}} value="Edit profile" 
      onClick={() => {
        setMove(!move)
      }}
    />
  )
}

export default EditProfile;