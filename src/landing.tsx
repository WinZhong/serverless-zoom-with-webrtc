/* eslint-disable no-restricted-globals */
import { LoadingOutlined, WarningOutlined } from '@ant-design/icons'
import React, { useEffect, useState } from 'react'
import * as utils from './meeting/utils'
import * as api from './meeting/api'

interface ILandingProps {
  supportRTC: boolean
  setReady: Function
}
export default function (props: ILandingProps) {
  return !props.supportRTC ? <NotSupport /> : <NotReady setReady={props.setReady} />
}

function NotSupport() {
  const isHttpReason = location.protocol === 'http:' &&
    ['localhost', '127.0.0.1'].indexOf(location.hostname) === -1
  return (<div className="not-support-mask">
    Your browser does not support WebRTC. <br />
    {isHttpReason ?
     '<b>Online Meeting</b> app is builded on technology <a href="" target="_blank">WebRTC</a>, due to the secure constraints,<br/> <b>this app only work under <i>HTTPS</i> protocol</b>':
     'Please upgrade your browser, or use latest <a href="https://www.google.cn/chrome/" target="_blank">Chrome</a> instead.'}
  </div>)
}


function NotReady(props: Pick<ILandingProps, 'setReady'>) {
  const [permissionState, setPermissionState] = useState<string>('prompt')
  const [timeCount, setTimeCount] = useState<number>(0)
  const [loadingState, setLoadingState] = useState<string>('init')
  
  const retry = () => {
    setTimeCount(timeCount + 1)
  }
  
  const permissionStr:{[k: string]: any} = {
    prompt: <p>Please allow camera and microphone access to continue, you can turn off camera or microphone later in meeting</p>,
    denied: <p>You should granted camera microphone permissions, <a onClick={retry}>click to retry</a></p>,
    granted: null
  }

  useEffect(() => {
    (async () => {
      const status = await utils.checkMediaPermission()
      setPermissionState(status ? 'granted' : 'denied')
      if (!status) return
      try {
        const sessID = location.hash.slice(1)
        if (sessID) {
          await api.getSessionInfo(sessID)
        }
        props.setReady('landing')
      } catch (error) {
        console.warn('failed to get session info', error)
        setLoadingState('Failed to get meeting info: ' + JSON.stringify(error))
      }
    })()
  }, [timeCount])
  const tip = permissionStr[permissionState] || (loadingState === 'init' ? 'loading...' : loadingState)
  return (<div className="landing-mask">
    <div style={{fontSize: '24px', textAlign: 'center'}}>
    {!permissionStr[permissionState] && loadingState === 'init' ?
      <LoadingOutlined spin style={{color: '#2495ff'}} /> :
      <WarningOutlined style={{color: '#f8ac14'}}/>
    } <br />
    {tip}
    </div>
  </div>)
} 